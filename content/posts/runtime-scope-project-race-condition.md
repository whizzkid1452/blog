---
title: 'Runtime Scope로 프로젝트 전환 Race Condition 정리하기'
description: '프로젝트 전환 중 이전 비동기 작업 결과가 새 프로젝트 상태에 섞이는 문제를 Runtime Scope로 방지한 과정을 정리합니다.'
date: '2026-06-02'
publishedAt: '2026-06-02T17:12:13+09:00'
tags: ['architecture', 'async', 'race-condition', 'runtime']
draft: false
---

## 1. 들어가며

이번 작업은 브라우저 기반 멀티미디어 편집기에서 새 프로젝트를 만들 때 발생한 FFmpeg 문제에서 시작했다. 프로젝트 A에서 영상 변환이 진행 중인데 사용자가 새 프로젝트 B를 만들면, A의 변환 결과가 늦게 끝난 뒤 B의 상태에 붙을 수 있었다. 처음에는 FFmpeg를 제대로 종료하지 못해서 생기는 문제라고 생각했다. 그런데 코드를 따라가다 보니 비슷한 문제가 썸네일 생성, 미디어 import, 오디오 복원, cloud sync에도 있었다. 결국 특정 라이브러리 하나의 문제가 아니었다. 오래 걸리는 작업이 끝났을 때 그 결과가 아직 유효한지 확인하지 않는 구조의 문제였다. 이 문제를 처음부터 명확하게 이해한 것은 아니었다. race condition이라는 말도 스레드나 공유 메모리 쪽에서 많이 보던 개념이라, 브라우저의 비동기 작업에도 같은 표현을 써도 되는지 다시 확인해야 했다. 처음에는 동시성 제어 문제와도 헷갈렸다. 작업을 하나씩 실행하면 해결되는 문제인지, 아니면 늦게 끝난 작업의 유효성을 확인해야 하는 문제인지 구분이 필요했다. 이번 글의 목표는 세 가지다.

- 프로젝트 전환 중 이전 비동기 작업이 왜 문제가 되는지 정리한다.
- localProjectId, epoch, snapshot, scope가 각각 무엇을 보호하는지 설명한다.
- 어떤 선택지를 비교했고 왜 현재 구조를 선택했는지 기록한다.

결론부터 적으면, 이 문제는 FFmpeg 단일 버그가 아니라 프로젝트 전환 중 이전 비동기 결과가 늦게 반영되는 async race condition이었다. 경쟁 상태는 여러 작업의 실행 순서나 완료 시점에 따라 결과가 달라지는 상태를 말한다.

출처: Race condition - Wikipedia, 경쟁 상태 설명 - KLDP

여기서 async race condition은 별도의 공식 개념이라기보다, 비동기 코드에서 발생한 경쟁 상태를 설명하기 위해 쓰는 표현에 가깝다. 이 글에서는 프로젝트 전환과 이전 비동기 작업의 완료 순서가 엇갈리면서 예전 작업 결과가 현재 프로젝트 상태에 잘못 반영되는 문제를 좁혀 부르기 위해 이 표현을 사용한다.

## 2. 문제가 발생한 흐름

## 2-1. 브라우저 멀티미디어 에디터의 상태 구조

이 프로젝트는 브라우저에서 동작하는 멀티미디어 에디터다. 사용자는 영상, 오디오, 이미지를 가져와 타임라인에 배치하고 미리보기 화면에서 편집 결과를 확인한다. 그래서 하나의 프로젝트는 단순한 문서 하나가 아니라 여러 미디어 파일, 편집 세션, 미리보기 상태, 런타임 리소스를 함께 가진다. 비디오를 import할 때는 영상 파일만 추가하는 것이 아니다. 편집기에서 오디오 파형을 보여주거나 오디오 트랙을 다루려면 영상 안의 오디오도 읽어야 한다. 이 과정에서 FFmpeg가 쓰인다. FFmpeg는 오디오와 비디오를 기록하고 변환하고 스트리밍할 수 있는 멀티미디어 처리 도구다. 이 글에서는 브라우저 안에서 영상 파일의 오디오를 디코딩하거나 파일을 변환하는 도구로 다룬다.

출처: FFmpeg 공식 사이트

대략적인 import 흐름은 다음과 같다.

```text
사용자가 비디오 선택
  -> media file 등록 준비
  -> FFmpeg로 오디오 디코딩
  -> 오디오 버퍼와 파형 준비
  -> session과 preview state에 반영
  -> thumbnail과 cache 갱신
```

이 흐름 중 FFmpeg 디코딩과 오디오 버퍼 준비는 시간이 걸릴 수 있다. 그 사이 사용자가 새 프로젝트를 만들면 A 프로젝트에서 시작한 import가 B 프로젝트가 열린 뒤 끝날 수 있다. 이 프로젝트는 하나의 편집기 화면 안에서 여러 종류의 상태를 함께 다룬다.

| 상태            | 예시                                       |
| --------------- | ------------------------------------------ |
| 프로젝트 정보   | 이름, 로컬 프로젝트 id, 원격 프로젝트 id   |
| 미디어 목록     | 영상, 오디오, 이미지 파일                  |
| 타임라인 세션   | 트랙, 소스, 구간                           |
| 미리보기 레이어 | 영상, 이미지, 텍스트 레이어                |
| 런타임 리소스   | 오디오 버퍼, 썸네일 캐시, FFmpeg instance  |
| 저장 상태       | local draft, cloud revision, upload status |

사용자가 새 프로젝트를 만들거나 cloud project를 열거나 revision을 복원하면 이 상태들이 한 번에 바뀐다.

```text
프로젝트 전환
  -> mediaFiles 교체
  -> session 교체
  -> preview layers 교체
  -> thumbnail cache 초기화
  -> audio buffer 초기화
  -> cloud identity 변경
```

문제는 이 전환이 일어나는 동안 이전 프로젝트에서 시작한 작업이 아직 끝나지 않았을 수 있다는 점이다.

## 2-2. A 프로젝트 작업이 B 프로젝트에 붙는 시간 순서

예를 들어 프로젝트 A에서 영상 import를 시작했다고 하자.

1. 프로젝트 A에서 영상 import 시작
2. FFmpeg 변환 또는 오디오 디코딩 진행
3. 사용자가 새 프로젝트 B 생성
4. 프로젝트 B의 session, mediaFiles, cache 적용
5. 프로젝트 A의 import 결과가 뒤늦게 완료
6. A의 결과가 B에 commit될 수 있음

이 문제는 코드가 항상 실패하는 문제가 아니다. 완료 순서에 따라 정상일 수도 있고 버그가 될 수도 있다. 핵심은 작업이 시작된 상태와 작업이 끝난 상태가 다를 수 있다는 것이다.

## 2-3. 이 글에서 쓰는 핵심 용어

처음부터 모든 용어를 한 번에 정리하면 오히려 흐름이 무거워진다. 이 글에서 계속 반복되는 핵심 용어만 먼저 정리한다.

| 용어                 | 설명                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| async race condition | 비동기 작업의 완료 순서에 따라 결과가 달라지는 경쟁 상태             |
| stale result         | 예전 상태 기준으로 만들어져 지금은 유효하지 않은 결과                |
| commit               | 비동기 작업 결과를 실제 store, session, cache, cloud에 반영하는 행위 |
| live read            | await 이후 현재 열린 프로젝트 상태를 다시 읽는 행위                  |
| snapshot             | 작업 시작 시점의 데이터를 고정해 둔 값                               |
| epoch                | 현재 브라우저 탭 안의 editor runtime 세대 번호                       |

이 중에서 가장 늦게 중요성을 느낀 것은 live read였다. 처음에는 예전 작업이 현재 store에 쓰는 것만 문제라고 생각했다. 하지만 예전 작업이 await 이후 현재 store를 다시 읽는 것도 같은 방식으로 문제가 될 수 있었다.

## 3. FFmpeg만의 문제가 아니었던 이유

## 3-1. 늦게 끝난 작업이 현재 프로젝트에 쓰는 문제

가장 먼저 보인 문제는 stale write였다. 예전 프로젝트에서 시작한 작업이 늦게 끝난 뒤 현재 프로젝트에 결과를 쓰는 경우다.

```ts
// 예전 프로젝트 작업이 늦게 끝난 뒤
useProjectStore.getState().addMediaFile(entry);
usePreviewStore.getState().addLayer(layer);
thumbnailCache.set(sourceId, bitmaps);
```

이런 코드는 현재 열린 프로젝트에 바로 결과를 쓴다. 작업이 시작된 프로젝트가 A였어도 지금 열린 프로젝트가 B라면 B에 결과가 들어간다. 이 문제는 FFmpeg 변환 결과에만 있지 않았다. 미디어 import가 늦게 끝난 뒤 현재 프로젝트에 media file을 추가할 수 있었다. 썸네일 생성이 늦게 끝난 뒤 현재 cache에 이전 프로젝트 이미지를 저장할 수 있었다. cloud sync가 await 이후 현재 store를 다시 읽으면 다른 프로젝트의 파일을 참조할 수 있었다. 공통점은 FFmpeg가 아니었다. 공통점은 비동기 작업과 프로젝트 전환이 같은 runtime 상태를 두고 시간 순서 경쟁을 한다는 점이었다.

## 3-2. await 이후 현재 store를 다시 읽는 문제

조금 더 늦게 발견한 문제는 stale read였다. 예전 프로젝트 작업이 await 이후 현재 store를 다시 읽는 경우다.

```ts
await uploadSomething();
const mediaFile = useProjectStore.getState().mediaFiles.find(...);
```

이 코드는 자연스러워 보인다. 하지만 await 동안 프로젝트가 바뀌면 getState()는 작업 시작 시점의 프로젝트가 아니라 현재 열린 프로젝트를 읽는다. 이 부분이 가장 조심스러웠다. 화면이 잠깐 이상해지는 정도가 아니라 cloud에 잘못된 파일 관계가 저장될 수 있기 때문이다. 그래서 async 작업은 시작 시점의 데이터를 snapshot으로 잡아야 한다.

```ts
// 나쁜 예
await uploadSomething();
const mediaFiles = useProjectStore.getState().mediaFiles;

// 좋은 예
const mediaFilesSnapshot = useProjectStore.getState().mediaFiles;
await uploadSomething();
use(mediaFilesSnapshot);
```

snapshot은 현재 store가 나중에 바뀌더라도 이 작업은 시작 당시의 데이터를 사용한다는 의미다.

## 3-3. 동시성 제어와 stale result 방지는 다른 문제

처음에는 이 문제를 동시성 제어 문제로 착각했다. FFmpeg 작업이 겹치니까 하나씩 실행하면 되지 않을까 싶었다. 실제로 FFmpeg는 싱글톤처럼 동작하고 하나의 instance 안에서 실행 상태와 메모리 파일 시스템을 공유하기 때문에 직렬화가 필요했다. 하지만 프로젝트 전환 문제의 핵심은 다른 쪽에 있었다. 동시성 제어는 여러 작업을 어떻게 같이 실행할 것인가에 가깝다. 동시에 몇 개까지 실행할지 정한다. 어떤 작업을 먼저 실행할지도 정한다. 같은 리소스를 쓰는 작업을 어떻게 줄 세울지도 다룬다. 프로젝트 전환 race 방지는 끝난 작업이 아직 반영되어도 되는가에 가깝다. 작업이 하나씩 실행되더라도 사용자가 중간에 프로젝트를 바꾸면 이전 작업 결과는 더 이상 유효하지 않을 수 있다.

| 구분                    | 질문                                   | 예시                               |
| ----------------------- | -------------------------------------- | ---------------------------------- |
| 동시성 제어             | 동시에 실행되는 작업을 어떻게 조절할까 | FFmpeg job을 하나씩 실행           |
| 프로젝트 전환 race 방지 | 늦게 끝난 결과가 아직 유효할까         | scope가 바뀌었으면 commit하지 않음 |

그래서 이번 작업에서는 두 문제를 분리해서 봤다. FFmpeg 내부 파일 충돌에는 동시성 제어가 필요했다. 프로젝트 전환에는 runtime scope가 더 중요한 기준이었다.

## 4. 유효성을 판단하는 기준 만들기

## 4-1. useEffect cleanup에서 얻은 힌트

이 문제를 정리하면서 예전에 React useEffect를 공부할 때 봤던 race condition 예시가 떠올랐다. useEffect 안에서 데이터를 가져오고 state를 업데이트할 때, 이전 요청이 나중에 끝나 최신 상태를 덮어쓰는 문제였다.

```tsx
useEffect(() => {
  let ignore = false;

  async function load() {
    const result = await fetchData(userId);

    if (!ignore) {
      setData(result);
    }
  }

  load();

  return () => {
    ignore = true;
  };
}, [userId]);
```

여기서 핵심은 fetch를 무조건 중단하는 것이 아니다. 이전 effect에서 시작한 비동기 작업이 늦게 끝났을 때, 그 결과를 아직 반영해도 되는지 확인한다는 점이다. cleanup 함수가 실행되면 이전 effect의 ignore 값이 true가 되고, 나중에 도착한 결과는 state에 반영되지 않는다. 이 구조가 프로젝트 전환 문제를 이해하는 데 힌트가 되었다.

| useEffect 예시          | 이 프로젝트의 경우                                      |
| ----------------------- | ------------------------------------------------------- |
| dependency 변경         | 프로젝트 전환 또는 revision restore                     |
| 이전 fetch 요청         | 이전 프로젝트의 import, thumbnail, sync 작업            |
| cleanup의 ignore = true | 이전 scope abort                                        |
| if (!ignore) setData()  | assertCurrentProjectScope(scope) 후 commit              |
| stale response          | stale import result, stale thumbnail, stale sync result |

다만 React 내부 구현이 이 글의 ProjectRuntimeScope 같은 runtime scope를 사용한다는 뜻은 아니다. useEffect의 cleanup은 React가 effect lifecycle에 맞춰 이전 effect를 정리해주는 메커니즘이고, ignore 값은 JavaScript closure 안에 남아 있는 로컬 변수다. 이번 작업에서 가져온 것은 React 내부 구현이 아니라 패턴이었다. 이전 작업의 결과가 늦게 도착할 수 있다면, 완료 시점에 그 결과가 아직 유효한지 확인해야 한다는 생각이다. ProjectRuntimeScope는 이 생각을 컴포넌트 하나가 아니라 편집기 전체 runtime에 적용한 구조에 가깝다. 이 관점은 아래 글들을 다시 읽으며 정리했다.

- React의 올바른 useEffect 사용팁 - Romantech
- React useEffect 사용하기 - Witch-Work
- [번역] useEffect 완벽 가이드 - rinae.dev
- Effect로 동기화하기 - React 공식 한국어 문서

## 4-2. localProjectId만으로 부족했던 이유

처음에는 작업 시작 시점의 project id를 저장해두고 나중에 비교하면 된다고 생각했다.

```text
내 작업:        프로젝트 A
현재 프로젝트:  프로젝트 A
                 -> 같음
```

하지만 같은 프로젝트 안에서도 문서와 runtime이 완전히 갈아엎어질 수 있다. 대표적인 경우가 revision restore다. 처음에는 revision과 epoch도 헷갈렸다. 둘 다 버전처럼 보였기 때문이다. 하지만 기준이 다르다. revision은 저장된 문서의 버전이다. cloud history나 restore에서 의미가 있다. epoch는 지금 브라우저 탭 안에서 열린 편집기 runtime의 세대다.

```text
revision: 저장된 문서의 버전
epoch:    현재 화면 runtime의 세대 번호
```

## 4-3. epoch 아이디어를 어디서 얻었는가

epoch는 갑자기 만든 이름이라기보다 세대 번호를 두고 유효성을 판단하는 패턴에서 힌트를 얻었다. 비동기 요청에서 흔히 쓰는 request id나 generation counter와 비슷한 방식이다.

```ts
const startedEpoch = currentEpoch;

const result = await longTask();

if (startedEpoch !== currentEpoch) {
  return;
}

commit(result);
```

작업 시작 시점의 세대를 캡처하고, 완료 시점에 현재 세대와 비교한다. 다르면 이전 세대에서 시작한 작업이므로 결과를 버린다. 이 흐름은 앞에서 본 useEffect cleanup의 ignore 패턴과도 닮아 있다. ignore가 boolean으로 이전 effect의 결과를 무효화한다면, epoch는 숫자로 현재 editor runtime 세대를 구분한다.

| 방식                  | 의미                       | 적합 범위                    |
| --------------------- | -------------------------- | ---------------------------- |
| ignore boolean        | 이 effect가 무효화됐는가   | 컴포넌트 effect 하나         |
| request id            | 이 요청이 최신 요청인가    | 검색, 자동완성, fetch        |
| generation 또는 epoch | 현재 runtime 세대와 같은가 | 앱 전체 상태, editor session |
| revision              | 저장된 문서 버전이 같은가  | 서버 저장, cloud history     |

운영체제나 시스템 쪽에서도 epoch라는 말을 쓰는 경우가 있다. 예를 들어 메모리 관리나 분산 시스템에서는 특정 시점 구간, 세대, term을 구분하기 위해 epoch와 비슷한 개념을 사용한다. 다만 이 글의 epoch가 운영체제나 분산 시스템의 epoch 알고리즘을 그대로 구현한 것은 아니다. 목적도 다르다. 여기서는 이전 비동기 결과가 현재 프로젝트 상태에 반영되지 않게 막는 것이 목적이다. 그래도 상태를 세대로 나누고, 작업이 시작된 세대와 현재 세대를 비교해 유효성을 판단한다는 사고방식은 비슷하다. 정리하면, 같은 이름을 쓸 만큼 개념적 유사성은 있지만 같은 알고리즘은 아니다. 이 글의 epoch는 브라우저 탭 안에서 현재 editor runtime 세대를 구분하기 위한 로컬 값이다.

## 4-4. epoch로 runtime 세대를 구분하기

그래서 epoch를 도입했다. epoch는 프로젝트 id가 아니라 현재 편집기 runtime의 세대 번호다. 판단은 간단하다.

```ts
scope.epoch === activeScope.epoch;
```

같으면 아직 같은 runtime이다. 다르면 예전 runtime에서 시작한 작업이다. 순서 정보가 핵심이라기보다 같은 세대인가가 핵심이었다. 숫자로 둔 이유는 UUID보다 로그와 테스트에서 순서가 잘 보이기 때문이다.

```text
epoch 10: import 시작
epoch 11: document apply
epoch 10: stale 처리
```

중요한 점은 epoch가 서버 revision을 대신하지 않는다는 것이다. 여러 탭에서 같은 프로젝트를 편집할 때 충돌을 판단하는 기준은 revision이나 parentRevisionId 쪽에 가깝다. epoch는 한 탭 안에서 이 작업이 지금 화면의 runtime에서 시작된 작업인가만 판단한다.

## 4-5. snapshot으로 시작 시점 데이터를 고정하기

scope가 commit 시점의 유효성을 판단한다면, snapshot은 작업 중 사용할 데이터를 고정한다. cloud sync처럼 저장 대상이 명확해야 하는 작업은 current store를 나중에 다시 읽지 않는 것이 중요하다.

```ts
const scope = getActiveProjectScope();
const mediaFilesSnapshot = useProjectStore.getState().mediaFiles;
const draft = buildDocument();

await syncToCloud(draft, mediaFilesSnapshot);
assertCurrentProjectScope(scope);
commitSyncResult();
```

이 구조는 아직 계속 다듬어야 하는 부분이다. 다만 방향은 분명해졌다. async 작업은 시작 시점의 기준 데이터를 들고 가야 한다.

## 4-6. AbortSignal로 이전 작업에 취소 신호 보내기

AbortSignal은 이전 작업에 취소 신호를 보내기 위한 값이다. AbortSignal은 비동기 작업에 취소 요청이 전달되었는지 알리는 신호 객체다. 어떤 작업은 이 신호를 받아 실제로 중단할 수 있다. 어떤 작업은 중단하지 못하더라도 완료 후 결과를 버리는 방식으로 처리할 수 있다.

출처: MDN - AbortSignal

프로젝트가 전환되면 이전 scope의 signal을 abort한다.

```ts
if (scope.signal.aborted) {
  return;
}
```

취소 가능한 작업은 중단한다. 취소하기 어려운 작업은 결과를 commit하기 전에 scope를 확인해 버린다.

## 5. 구현한 구조

## 5-1. ProjectRuntimeScope

scope는 React state가 아니라 module-level runtime 값으로 두었다. module-level runtime은 특정 파일 안에 살아 있는 실행 상태다. React component state처럼 화면 렌더링을 위해 존재하는 값이 아니다. local draft처럼 저장소에 남기는 데이터도 아니다. 앱이 켜져 있는 동안 현재 작업을 제어하기 위해 메모리에 들고 있는 값에 가깝다.

```ts
// runtime/projectRuntimeScope.ts
let activeScope: ProjectRuntimeScope = createInitialScope();

export function getActiveProjectScope(): ProjectRuntimeScope {
  return activeScope;
}

export function beginNewProjectScope(reason: string): ProjectRuntimeScope {
  activeScope.controller.abort();
  activeScope = createNextScope(reason);
  return activeScope;
}
```

처음에는 이런 값을 store에 넣어야 하나 고민했다. 하지만 store는 UI가 읽고 반응해야 하는 상태나 저장 가능한 프로젝트 상태에 더 잘 맞는다. 반대로 scope는 이전 작업을 취소하고 현재 작업 세대를 바꾸는 제어용 값이다.

```ts
// runtime/projectRuntimeScope.ts
export interface ProjectRuntimeScope {
  readonly epoch: number;
  readonly localProjectId: string;
  readonly signal: AbortSignal;
  readonly reason: string;
}
```

이 값을 module-level로 둔 이유는 다음과 같다.

- encoder, cloud sync, FFmpeg service 같은 비-React 모듈에서도 필요했다.
- AbortController는 저장 가능한 상태가 아니다.
- 이 값은 UI 상태가 아니라 runtime control state다.

대신 주의할 점도 있다. module-level 값은 숨은 전역 상태처럼 보일 수 있다. 그래서 아무 곳에서나 바꾸면 흐름을 추적하기 어렵다. 이번에는 beginNewProjectScope()와 coordinator를 통해서만 세대를 바꾸도록 제한했다.

## 5-2. ProjectRuntimeCoordinator

프로젝트 전환 시 해야 할 cleanup을 한 곳에 모았다.

```ts
// runtime/projectRuntimeCoordinator.ts
export function resetProjectRuntimeForDocumentApply(reason: string): ProjectRuntimeScope {
  releaseFFmpeg(reason);
  abortAllThumbnailRequests();
  abortAllThumbnailGeneration();
  thumbnailCache.clear();
  posterCache.clear();
  resetRuntimeForAppliedDocument();

  return beginNewProjectScope(reason);
}
```

이전에는 applyDocument()가 여러 subsystem의 cleanup을 직접 알고 있었다. coordinator를 두면서 프로젝트 전환 시 runtime을 정리하는 곳이 명확해졌다.

## 5-3. FFmpeg 전체 job 직렬화

FFmpeg에서는 직렬화가 필요했다. 하나의 FFmpeg instance가 내부 실행 상태와 메모리 파일 시스템을 공유하고 있었기 때문이다. 처음에는 exec만 순서대로 실행하면 충분하다고 생각했다. 하지만 실제 흐름은 더 길었다.

```text
writeFile -> exec -> readFile -> cleanup
```

그래서 전체 흐름을 하나의 job으로 묶었다.

```ts
// engine/encoder/ffmpegService.ts
export async function runFFmpegJob<T>(
  scope: ProjectRuntimeScope,
  label: string,
  job: (ctx: { ffmpeg: FFmpeg; workPrefix: string }) => Promise<T>
): Promise<T> {
  const run = jobChain.then(async () => {
    if (scope.signal.aborted) throw new StaleProjectScopeError(scope.reason);
    const ffmpeg = await getFFmpeg();
    if (scope.signal.aborted) throw new StaleProjectScopeError(scope.reason);

    const workPrefix = `job_${label}_${(jobSeq += 1)}_`;
    try {
      return await job({ ffmpeg, workPrefix });
    } finally {
      await deleteFilesWithPrefix(ffmpeg, workPrefix);
    }
  });

  jobChain = run.then(
    () => undefined,
    () => undefined
  );
  return run as Promise<T>;
}
```

이 선택은 병렬성을 일부 포기한다. 하지만 브라우저에서 하나의 FFmpeg instance와 메모리 파일 시스템을 공유하는 상황에서는 안정성이 더 중요하다고 판단했다.

## 5-4. commit 직전 scope 확인

긴 작업은 시작 시점에 현재 scope를 캡처한다.

```ts
const scope = getActiveProjectScope();
```

그리고 결과를 반영하기 직전에 확인한다.

```ts
assertCurrentProjectScope(scope);
commitImportedMedia(result);
```

중요한 것은 확인 위치다. 작업 시작 전에 확인하는 것보다 await 이후 commit 직전에 확인하는 것이 더 중요하다.

## 6. 구조 정리

## 6-1. 프로젝트 전환 시 runtime을 교체하는 흐름

## 6-2. FFmpeg job이 파일을 격리하는 흐름

## 7. 변경 결과와 남은 구멍

## 7-1. 변경 전후 비교

| 항목         | 변경 전                         | 변경 후                                 |
| ------------ | ------------------------------- | --------------------------------------- |
| 전환 cleanup | applyDocument()에 직접 나열     | coordinator로 중앙화                    |
| stale 판단   | 일부 경로의 localProjectId 비교 | 공통 epoch 기반 scope                   |
| FFmpeg 처리  | exec 중심 직렬화                | 전체 job 직렬화                         |
| import guard | video 중심                      | audio, image, replace 계열로 확장       |
| restore 작업 | 일부 localProjectId 기준        | scope 기준으로 통일                     |
| cloud sync   | current store read/write 위험   | live write guard와 snapshot 필요성 확인 |

이 변경으로 이전 작업 결과가 현재 프로젝트에 섞일 가능성을 줄였다. 특히 FFmpeg는 파일 작업 전체를 job으로 묶었다. 그 결과 import, export, thumbnail fallback 간의 충돌 가능성을 낮췄다. 하지만 아직 완벽하다고 생각하지는 않는다. 리뷰 과정에서 live read가 여전히 문제가 될 수 있다는 점을 다시 확인했다. scope check는 write뿐 아니라 read에도 필요하다. cloud sync는 snapshot 기준을 더 강하게 가져가야 한다.

## 7-2. local save의 scope 캡처 시점

save 작업은 시작 시점에 scope를 더 빨리 잡아야 한다. persistLocalMediaAssets()처럼 await 이후 live store에 쓰는 작업은 같은 문제를 다시 만들 수 있다.

## 7-3. cloud sync의 snapshot 기준

cloud sync는 draft뿐 아니라 media file snapshot도 함께 들고 가는 구조가 더 안전하다. stale 상태에서 current mediaFiles를 다시 읽으면 다른 프로젝트 파일을 업로드할 수 있다.

## 7-4. thumbnail cache의 write guard

thumbnail cache는 worker, seek, IndexedDB seed, FFmpeg fallback에서 모두 쓰일 수 있다. cache write 직전에 scope를 확인하는 규칙을 더 일관되게 적용해야 한다.

## 8. 마치며

이번 작업에서 가장 크게 배운 것은 특정 API 사용법이 아니라 느린 작업의 결과가 언제까지 유효한지 명시하는 습관이었다. 처음에는 내가 이 문제를 충분히 알고 있다고 생각하지 못했다. race condition이라는 단어를 써도 되는지부터 다시 확인했다. localProjectId와 epoch의 차이도 여러 번 예시를 만들어보며 이해했다. 부족한 상태에서 시작했지만, 그래서 오히려 문제를 더 작게 쪼개서 볼 수 있었다. 아직 남은 구멍도 있다. 특히 live read와 snapshot 문제는 계속 신경 써야 한다. 그래도 이번 작업을 통해 비동기 작업은 시작 시점과 완료 시점이 다를 수 있다는 당연한 사실을 코드 구조에 반영하는 방법을 조금 더 이해하게 되었다. 다음 단계에서는 local save와 cloud sync의 snapshot 기준을 더 명확히 할 예정이다. thumbnail cache write guard도 더 촘촘히 맞출 예정이다.

## 참고

참고한 개발 블로그

- React의 올바른 useEffect 사용팁 - Romantech
- React useEffect 사용하기 - Witch-Work
- [번역] useEffect 완벽 가이드 - rinae.dev
- Race Condition in React - Medium
- AbortController in UseEffect - Tistory
- fetch 요청의 취소와 AbortController - Tistory

공식 문서와 개념 자료

- Effect로 동기화하기 - React 공식 한국어 문서
- FFmpeg 공식 사이트
- ffmpeg.wasm Overview
- AbortSignal - MDN
- WebAssembly의 개념 - MDN 한국어
- Race condition - Wikipedia
- 경쟁 상태 설명 - KLDP
