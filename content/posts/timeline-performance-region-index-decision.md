---
title: '1,518개 Region 타임라인의 Long Task를 74% 줄인 과정'
description: 'Region 500개 이상에서 편집이 어려웠던 문제를 재현하고, 반복 실행 경로를 좁혀 Long Task 횟수와 누적 시간을 줄인 판단 과정과 트레이드오프를 정리합니다.'
date: '2026-07-24'
tags: ['react', 'performance', 'timeline', 'canvas', 'architecture']
draft: false
visibility: public
---

## [sort1] 1. 들어가며

사용자로부터 다중 트랙에서 Region을 500개 이상 사용하면 화면이 심하게 버벅여 편집하기 어렵다는 제보를 받았다. Region은 타임라인에 배치된 시작·종료 시간을 가진 편집 단위다.

실제 프로젝트를 Generate해 18개 Track과 1,518개 Region을 만들고 같은 가로 스크롤을 반복했다. 변경 전에는 10초 동안 Long Task가 74회 발생했고 누적 시간은 4,418ms였다. Region 조회와 TrackRow 갱신 경로를 나눈 뒤에는 19회, 1,154ms로 줄었다.

다만 이 수치만으로 타임라인의 전체 작업량이 줄었다고 말할 수는 없다. 메인 스레드 CPU 비율과 앱 전체 React commit 수는 감소하지 않았기 때문이다. 확인할 수 있는 결과는 **메인 스레드를 50ms 이상 연속으로 점유한 작업의 횟수와 누적 시간이 줄었다**는 것이다.

이 글은 다음 질문에 답하는 과정이다.

> 사용자가 편집하기 어려울 정도의 버벅임을 어떻게 측정하고, 어떤 반복 작업부터 줄일 것인가?

처음 떠올린 해결책은 화면 밖 TrackRow를 제거하는 세로 Track 가상화였다. 하지만 코드를 확인하니 스크롤마다 모든 Region을 조회하고, Canvas 갱신을 위해 모든 TrackRow에 변경된 prop을 전달하고 있었다. 그래서 Region 시간 인덱스와 React·Canvas 갱신 경로 분리를 먼저 적용했다. 세로 Track 가상화는 대안에서 제외하지 않고, 현재 데이터 규모와 구현 비용을 기준으로 순서를 뒤로 미뤘다.

구체적인 코드와 테스트는 [대용량 오디오 처리 성능 개선 글](/posts/large-scale-audio-processing-pipeline)에서 확인할 수 있다.

## [sort1] 2. 버벅임을 먼저 측정 가능한 문제로 바꿨다

### [sort2] 2-1. 버벅임은 증상이지 원인이 아니었다

사용자가 경험한 것은 화면이 끊기고 스크롤과 편집 입력이 바로 반영되지 않는 현상이었다. 이 증상만으로 원인을 하나로 정할 수는 없다.

같은 현상은 다음 경로에서 모두 발생할 수 있다.

- JavaScript 계산이 길어지는 경우
- React 컴포넌트 실행과 commit이 반복되는 경우
- Canvas draw가 오래 걸리는 경우
- 브라우저 layout·paint가 지연되는 경우
- 메모리 회수가 실행 흐름을 막는 경우

여기서 바로 “Track이 많아서 느리다”고 결론 내리면 세로 가상화라는 해결책에 문제를 맞추게 된다. 반대로 “React가 느리다”고 단정하면 `memo`나 상태 분리만 보게 된다.

먼저 해야 할 일은 해결책을 고르는 것이 아니라, 사용자가 말한 버벅임을 어떤 수치로 나눌지 정하는 것이었다.

### [sort2] 2-2. FPS 하나로는 작업 불가능 상태를 설명하기 어려웠다

화면이 버벅이는 문제를 설명할 때 FPS를 먼저 보기 쉽다. 하지만 FPS만으로는 입력이 왜 늦었는지, 어떤 작업이 메인 스레드를 막았는지 알기 어렵다.

이번 측정에서는 다음 값을 함께 봤다.

| 지표                        | 확인하려는 질문                                                |
| --------------------------- | -------------------------------------------------------------- |
| Long Task 횟수·누적 시간    | 메인 스레드를 오래 막는 작업이 얼마나 발생했는가               |
| 입력 후 다음 frame p95      | 입력이 DOM에 도착한 뒤 다음 화면 갱신 기회까지 얼마나 걸렸는가 |
| DOM wheel 입력 수신율       | 전송한 wheel 입력 중 DOM에서 관찰된 비율은 얼마인가            |
| 메인 스레드 CPU 비율        | 측정 구간에서 Renderer task가 실행된 비율은 얼마인가           |
| React commit·actualDuration | React 렌더링 작업량은 어떻게 변했는가                          |

[W3C Long Tasks API](https://www.w3.org/TR/longtasks-1/)는 50ms 이상 UI thread를 점유하는 task를 관찰한다. 이런 task는 입력과 스크롤 같은 다른 작업의 실행을 늦출 수 있다. 사용자가 “화면이 멈춘다”고 말한 상황과 직접 연결해 볼 수 있는 지표였다.

다만 Long Task가 줄었다고 전체 CPU 사용량이 줄었다는 뜻은 아니다. 긴 작업 하나가 짧은 작업 여러 개로 나뉘어도 Long Task 지표는 좋아질 수 있다. 그래서 CPU와 React 지표를 함께 기록했다.

## [sort1] 3. 먼저 재현 조건을 고정했다

성능 비교에는 같은 동작을 반복할 수 있는 기준선이 필요했다. 실제 프로젝트 JSON을 Generate한 결과를 고정 fixture로 저장하고 다음 조건에서 가로 스크롤을 반복했다.

```text
Track: 18개
Region: 1,518개
측정 시간: 10초
wheel 입력: 303회
입력 간격: 33ms
스크롤 거리: 480px
반복 횟수: 변경 전·후 각각 3회
대표값: 3회 중앙값
```

Electron Renderer에는 Playwright의 [`connectOverCDP`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)로 연결했다. 이 API는 실행 중인 Chromium 기반 브라우저에 Chrome DevTools Protocol(CDP)로 연결한다.

비교 수치는 Chrome Trace를 끄고 측정했다. Trace를 켜면 event 수집 자체가 실행 중인 앱에 추가 작업을 만들었고, 실제 측정에서도 절대값과 변경 전후 방향이 반복 측정과 달라졌다.

그래서 측정 도구의 역할을 나눴다.

- **변경 전후 비교:** Trace를 끄고 3회 중앙값 사용
- **실행 흐름 분석:** [CDP Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/)을 켠 별도 실행 사용
- **CPU 지표 수집:** [CDP Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)에서 `threadTicks` 기준 runtime metric 사용

이 구분은 중요한 트레이드오프였다. 상세한 Trace를 얻으면 call stack을 분석할 수 있지만 측정 대상에도 영향을 준다. 반대로 Trace를 끄면 비교 수치는 안정되지만 어떤 함수가 시간을 사용했는지 알기 어렵다. 하나의 실행으로 두 목적을 모두 만족시키려 하지 않았다.

## [sort1] 4. 코드에서 반복 경로를 두 개로 나눴다

### [sort2] 4-1. 보이는 범위를 계산해도 Region은 전부 확인하고 있었다

기존 코드에는 이미 가로 virtualizer가 있었다. 타임라인을 pixel chunk로 나누고 현재 화면과 overscan 범위를 계산했다.

처음에는 이 구조 때문에 화면 밖 Region은 계산하지 않을 것이라고 생각했다. 하지만 실제 조회 코드는 각 트랙의 모든 Region을 `filter`로 확인하고 있었다.

```ts
const visibleRegions = regions.filter(region => {
  return region.end >= viewport.start && region.start <= viewport.end;
});
```

여기서 구분해야 할 것이 있었다.

```text
가로 virtualizer
→ 현재 화면의 시간 범위를 계산

Region 조회
→ 그 범위와 겹치는 데이터를 찾음
```

보이는 범위를 아는 것과 그 범위에 속한 데이터를 빠르게 찾는 것은 다른 문제다. 기존 구조는 첫 번째 문제를 해결했지만 두 번째 문제는 여전히 Region 수에 비례하는 선형 조회였다.

### [sort2] 4-2. Canvas 갱신 때문에 React 컴포넌트까지 다시 실행됐다

두 번째 경로는 스크롤 상태 전달이었다. 부모 컴포넌트는 화면 프레임마다 `scrollVersion`을 증가시키고 모든 TrackRow에 prop으로 전달했다.

```text
scroll event
→ scrollVersion 변경
→ 모든 TrackRow prop 변경
→ TrackRow 컴포넌트 실행
→ Canvas 갱신
```

TrackRow는 `React.memo`로 감싸져 있었지만 매번 다른 prop을 받았다. [React 공식 문서](https://react.dev/reference/react/memo)는 props가 같을 때 렌더링을 건너뛸 수 있다고 설명한다. 스크롤 프레임마다 값이 바뀌면 `memo`가 건너뛸 조건이 사라진다.

여기서 다시 질문을 나눴다.

- 스크롤할 때 TrackRow의 React 출력이 바뀌어야 하는가?
- 아니면 Canvas가 새로운 위치를 기준으로 다시 그려지기만 하면 되는가?

실제 필요는 두 번째에 가까웠다. React 컴포넌트 실행과 Canvas invalidation을 같은 경로에 둘 이유가 약해졌다.

## [sort1] 5. 세 가지 선택지를 같은 기준으로 비교했다

확인한 두 경로를 기준으로 세 가지 선택지를 비교했다.

| 선택지             | 직접 줄이는 비용                         | 얻는 점                             | 비용과 한계                                                 |
| ------------------ | ---------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| 세로 Track 가상화  | 화면 밖 TrackRow의 React·DOM·Canvas 비용 | Track 수가 많을 때 마운트 수를 제한 | 드래그·선택·재정렬·동적 높이 좌표계를 함께 변경             |
| Region 시간 인덱스 | 스크롤마다 실행되는 Region 전체 조회     | Region 수가 늘어도 후보 범위만 확인 | 목록 변경 시 정렬과 인덱스 재생성 필요                      |
| 스크롤 신호 분리   | 스크롤 prop 변경으로 인한 TrackRow 실행  | React 렌더링 없이 Canvas 갱신 가능  | 명령형 구독 lifecycle이 생기며 모든 Canvas 갱신 요청은 남음 |

판단 기준은 “어떤 기술이 더 고급인가”가 아니었다.

1. 실제 데이터에서 빠르게 증가하는 값이 무엇인가
2. 확인한 반복 경로를 직접 줄이는가
3. 편집 상호작용에 미치는 변경 범위가 얼마나 큰가
4. 단위 테스트와 실제 앱 측정으로 검증할 수 있는가
5. 문제가 다시 커졌을 때 다음 선택으로 확장할 수 있는가

실제 프로젝트의 Track은 주로 10~15개였고 측정 프로젝트는 18개였다. 반면 Region은 1,518개까지 증가했다. 이 조건에서는 세로 Track 가상화보다 Region 전체 조회가 데이터 증가 축에 더 가까웠다.

또한 Track 가상화는 단순히 DOM을 숨기는 작업이 아니었다. 화면 밖 TrackRow를 unmount하면 드래그 좌표, 선택 영역, Track 재정렬, 고정 Track, 서로 다른 Track 높이와 Canvas lifecycle을 모두 가상 좌표계에 맞춰야 했다.

예상 이득이 없다는 뜻은 아니다. 현재 Track 수에서는 변경 범위에 비해 먼저 얻을 수 있는 이득이 작다고 판단했다.

## [sort1] 6. 첫 번째 결정은 Region 조회 방식을 바꾸는 것이었다

### [sort2] 6-1. 시작 시간만 정렬하면 긴 Region을 놓칠 수 있었다

가장 단순한 방법은 Region을 시작 시간순으로 정렬하고 화면 시작 시간 근처부터 찾는 것이다. 하지만 Region은 점이 아니라 구간이다.

```text
Region A: 0초 ───────────────────────── 100초
현재 화면:                         90초 ─ 95초
```

Region A는 화면보다 훨씬 먼저 시작했지만 현재 화면과 겹친다. 시작 시간만 기준으로 탐색하면 이런 긴 Region을 놓칠 수 있다.

그래서 두 값을 함께 저장했다.

- 시작 시간순으로 정렬한 Region
- 각 위치까지 등장한 Region의 최대 종료 시간

```ts
function createPrefixMaxEnd(ends: number[]): number[] {
  const prefixMaxEnd: number[] = [];
  let maximumEnd = Number.NEGATIVE_INFINITY;

  for (const end of ends) {
    maximumEnd = Math.max(maximumEnd, end);
    prefixMaxEnd.push(maximumEnd);
  }

  return prefixMaxEnd;
}
```

종료 시간이 `[4, 100, 12, 30]`이면 누적 최대 종료 시간은 `[4, 100, 100, 100]`이 된다. 이 값을 사용하면 현재 화면까지 이어질 가능성이 있는 가장 이른 후보를 찾을 수 있다.

### [sort2] 6-2. 인덱스 생성 비용을 스크롤 밖으로 옮겼다

인덱스 생성에는 정렬 때문에 `O(N log N)`이 필요하다. 이 비용을 없앤 것이 아니라 실행 시점을 바꿨다.

Region 목록이 바뀔 때 인덱스를 만들고, 스크롤 중에는 같은 인덱스를 재사용했다.

```tsx
const visibleRegionIndex = useMemo(() => createVisibleRegionIndex(regions), [regions]);
```

화면 범위를 조회할 때는 두 번의 이진 탐색으로 후보 구간의 양 끝을 찾았다.

1. 누적 최대 종료 시간이 화면 시작 시간 이상인 첫 위치
2. Region 시작 시간이 화면 종료 시간보다 큰 첫 위치

이 결정의 핵심은 “모든 비용을 줄인다”가 아니었다.

> 상대적으로 드물게 발생하는 Region 목록 변경에 인덱스 생성 비용을 지불하고, 자주 발생하는 스크롤 조회 비용을 줄인다.

### [sort2] 6-3. 시간 인덱스에도 비용이 있었다

시간 인덱스를 선택하면서 다음 비용을 받아들였다.

- Region 목록 변경 시 정렬과 보조 배열 생성
- 정렬된 배열과 누적 최대 종료 시간 배열을 위한 추가 메모리
- 기존 렌더링 순서를 보존하기 위한 결과 재정렬
- 잘못된 시간 범위와 화면 경계 조건을 처리하는 테스트 증가

조회 함수 전체를 단순히 `O(log N)`이라고 표현할 수도 없었다. 이진 탐색 뒤에는 후보 검사와 기존 순서 복원이 남는다. 반환 Region이 `V`개라면 순서 복원에 `O(V log V)`가 추가된다.

synthetic benchmark에서는 700개 Region에 대해 2,000개 화면 범위를 조회했다. 선형 조회는 1,400,000개 Region을 검사했고, 인덱스 조회는 20,798개 후보를 검사했다. 후보 검사 횟수는 약 98.5% 감소했다.

하지만 이 값은 사용자 체감 시간이 아니다. 조회 알고리즘이 확인한 데이터 수를 비교한 결과일 뿐이다. 실제 스크롤 반응성은 Electron 앱에서 별도로 측정해야 했다.

## [sort1] 7. 두 번째 결정은 React와 Canvas의 갱신 경로를 나누는 것이었다

### [sort2] 7-1. 상태가 아니라 알림이 필요했다

스크롤 중 TrackRow가 필요로 한 것은 새로운 React UI 상태가 아니었다. Canvas가 새로운 가로 위치를 기준으로 다시 그려져야 한다는 알림이었다.

그래서 숫자 prop 대신 참조가 유지되는 작은 신호 객체를 전달했다.

```ts
interface ScrollFrameSignal {
  subscribe: (listener: () => void) => () => void;
  emit: () => void;
}
```

TrackRow는 이 신호를 구독하고 이벤트가 오면 Canvas invalidation만 요청한다. 신호 객체의 참조는 유지되기 때문에 스크롤만 발생했을 때 `React.memo`는 TrackRow 실행을 건너뛸 수 있다.

같은 화면 프레임 안에서 여러 스크롤 이벤트가 발생할 수 있으므로 `requestAnimationFrame`이 이미 예약돼 있으면 추가 예약을 만들지 않았다.

```tsx
if (scrollFrameId.current !== 0) return;

scrollFrameId.current = requestAnimationFrame(() => {
  scrollFrameId.current = 0;
  scrollFrameSignal.emit();
});
```

이 방식은 스크롤 이벤트 자체를 줄이지 않는다. 같은 화면 프레임 안에서 발생한 Canvas 갱신 요청을 한 번으로 합친다.

### [sort2] 7-2. 선언형 React 경로를 줄이는 대신 명령형 lifecycle이 생겼다

신호 기반 갱신은 비용이 없는 선택이 아니었다.

- TrackRow가 신호를 구독하고 unmount 시 해제해야 한다.
- 최신 Canvas draw 함수를 안전하게 참조해야 한다.
- 모든 Track Canvas에는 여전히 invalidation이 전달된다.
- 부모에서 `scrollVersion`을 사용하는 다른 UI 경로는 남아 있다.

따라서 이 작업은 “React 상태를 제거했다”가 아니다. Canvas 갱신만 필요한 TrackRow 경로를 React 렌더링에서 분리한 것이다.

단위 테스트도 이 범위에 맞췄다. 15개 TrackRow에 240회 스크롤 신호를 보냈을 때 TrackRow 실행은 최초 15회에 머물고 Canvas invalidation은 `15 × 240 = 3,600회` 발생하는지 확인했다.

이 테스트는 TrackRow React 렌더링이 격리됐다는 사실만 증명한다. Canvas draw 비용이나 실제 FPS가 개선됐다는 사실은 증명하지 않는다.

## [sort1] 8. 세로 Track 가상화를 보류한 이유

세로 Track 가상화를 제외한 것이 아니라 순서를 뒤로 미뤘다.

현재 조건에서 판단은 다음과 같았다.

```text
Track 수: 주로 10~15개, 측정 프로젝트 18개
Region 수: 측정 프로젝트 1,518개
확인한 반복 작업: Region 전체 조회, TrackRow prop 변경
```

Region 시간 인덱스와 스크롤 신호 분리는 확인한 두 경로를 직접 줄였다. 반면 세로 Track 가상화는 Track 수가 훨씬 많아질 때 더 큰 효과를 기대할 수 있었고, 편집 좌표계와 lifecycle에 미치는 영향도 컸다.

다음 조건에서는 결정을 다시 검토해야 한다.

- Track 수가 현재 일반 범위를 크게 넘어설 때
- 화면 밖 Track Canvas의 draw 시간이 주요 비용으로 측정될 때
- TrackRow 마운트 수가 메모리나 초기 진입 시간을 제한할 때
- 드래그·선택·재정렬을 가상 좌표계로 옮길 비용을 감수할 만큼 이득이 커질 때

> 적용하지 않은 대안도 다시 검토할 조건까지 정해야 설계 판단이 완결된다.

## [sort1] 9. 측정 결과가 결론을 더 좁게 만들었다

Trace를 끄고 변경 전후를 각각 3회 실행한 중앙값은 다음과 같았다.

| 지표                   | 변경 전 | 변경 후 |       변화 |
| ---------------------- | ------: | ------: | ---------: |
| Long Task 횟수         |    74회 |    19회 | 74.3% 감소 |
| Long Task 누적 시간    | 4,418ms | 1,154ms | 73.9% 감소 |
| Long Task p95          |    82ms |    88ms |  7.3% 증가 |
| DOM wheel 입력 수신율  |   83.8% |   91.7% | 7.9%p 향상 |
| 입력 후 다음 frame p95 |  75.1ms |  71.2ms |  5.2% 단축 |

긴 task의 횟수와 누적 시간은 감소했다. DOM에서 관찰한 wheel 입력도 늘었다. 이 결과는 긴 시간 동안 입력 처리를 막는 작업이 줄었다는 해석과 일치한다.

하지만 모든 지표가 좋아진 것은 아니었다.

| 지표                      | 변경 전 | 변경 후 |        변화 |
| ------------------------- | ------: | ------: | ----------: |
| 메인 스레드 CPU 비율      |   82.7% |   84.3% |  1.6%p 증가 |
| React commit              | 2,581회 | 2,950회 |  14.3% 증가 |
| React actualDuration 누적 | 2,875ms | 3,741ms |  30.1% 증가 |
| animation frame gap p95   | 100.2ms | 100.1ms | 사실상 동일 |

이 결과 때문에 “전체 렌더링 비용을 줄였다”거나 “메인 스레드 작업량을 줄였다”고 쓸 수 없었다. 확인할 수 있는 결론은 더 좁았다.

> 전체 CPU와 React 작업량은 줄지 않았지만, 메인 스레드를 오래 연속으로 막는 task의 횟수와 누적 시간은 감소했다.

작업이 더 짧은 단위로 나뉘었을 가능성과는 일치하지만, 측정값만으로 인과관계를 확정할 수는 없다. 남아 있는 Long Task의 call stack과 Canvas draw 구간을 더 분류해야 한다.

좋아지지 않은 지표는 실패한 숫자가 아니었다. 이번 변경이 해결한 범위와 다음 병목을 구분해 준 데이터였다.

## [sort1] 10. 이번 작업에서 배운 판단 기준

### [sort2] 10-1. 컴포넌트 수보다 증가 축을 먼저 봐야 했다

화면이 복잡해 보인다고 항상 DOM 가상화가 먼저인 것은 아니었다. Track 수와 Region 수 중 실제로 더 빠르게 증가하는 값이 무엇인지 확인해야 했다.

이번 프로젝트에서는 Region 수가 주요 증가 축이었다. 그래서 TrackRow 마운트 수보다 Region 조회 경로를 먼저 바꾸는 편이 확인한 문제에 더 가까웠다.

### [sort2] 10-2. “보이는 것만 렌더링”은 두 질문으로 나뉜다

가상화가 현재 화면 범위를 알려 주더라도, 그 범위에 들어오는 데이터를 매번 전체 순회로 찾으면 조회 비용은 남는다.

다음 두 질문을 분리해야 했다.

1. 현재 보이는 범위는 어디인가?
2. 그 범위에 속한 데이터를 어떻게 찾는가?

첫 번째는 virtualizer가, 두 번째는 시간 인덱스가 해결했다.

### [sort2] 10-3. React 렌더링과 명령형 Canvas 갱신은 같은 경로일 필요가 없다

React UI 출력이 바뀌지 않고 Canvas에 다시 그리기만 요청하면 되는 경우, 매 프레임 바뀌는 값을 prop으로 전달할 이유가 약하다.

반대로 신호 기반 갱신은 구독 해제와 최신 함수 참조 같은 lifecycle 책임을 만든다. 선언형 경로를 줄였다는 이유만으로 항상 더 좋은 구조라고 말할 수는 없다.

### [sort2] 10-4. 성능 개선의 결론은 가장 나쁜 지표까지 포함해야 한다

Long Task만 보면 큰 개선처럼 보였다. CPU와 React 지표를 함께 보면 전체 작업량이 감소했다는 결론은 내릴 수 없었다.

성능 작업에서는 좋아진 숫자보다 결론의 범위를 제한하는 숫자가 더 중요할 때가 있다. 그래야 다음 최적화가 같은 경로를 반복하지 않는다.

## [sort1] 11. 다음에 확인할 것

이번 변경 뒤에도 모든 TrackRow는 마운트되고 모든 Track Canvas가 스크롤 신호를 받는다. 다음 순서는 다음과 같다.

1. Chrome Trace에서 남은 Long Task의 JavaScript call stack 분류
2. Track별 Canvas draw 횟수와 실행 시간 측정
3. 세로 화면 밖 Track Canvas invalidation 차단
4. Track 수가 증가할 때 세로 가상화의 손익 재측정
5. TrackRow 외에 스크롤 상태를 구독하는 React 경로 분리

이 측정에서 화면 밖 Canvas draw가 주요 비용으로 확인되거나 Track 수가 일반 범위를 크게 넘어가면, 세로 Track 가상화의 우선순위는 다시 올라간다.

## [sort1] 12. 마치며

처음에는 화면이 버벅인다는 증상에서 바로 해결책을 고르려 했다. 하지만 데이터를 다시 보니 Track은 18개였고 Region은 1,518개였다. 코드에서는 Region 전체 조회와 스크롤 prop 변경이 반복되고 있었다.

그래서 확인한 반복 경로부터 바꿨다. 화면과 겹칠 가능성이 있는 Region만 찾도록 시간 인덱스를 만들고, Canvas 갱신 신호를 TrackRow의 React prop에서 분리했다. 세로 Track 가상화는 Track 수와 화면 밖 Canvas 비용이 더 커질 때 다시 검토할 대안으로 남겼다.

측정 결과 Long Task 횟수는 74.3%, 누적 시간은 73.9% 줄었다. DOM wheel 입력 수신율도 7.9%p 높아졌다. 반면 CPU와 React 작업량은 줄지 않았다. 따라서 이번 변경의 결과는 “전체 렌더링 비용 감소”가 아니라 **긴 메인 스레드 점유 감소**로 한정했다.

> 성능 최적화는 해결책을 먼저 고르는 일이 아니라, 사용자의 증상을 측정 가능한 지표로 바꾸고 반복 비용을 하나씩 줄이는 일이다.

## 참고

- [React 공식 문서: `memo`](https://react.dev/reference/react/memo)
- [W3C Long Tasks API](https://www.w3.org/TR/longtasks-1/)
- [Playwright 공식 문서: `connectOverCDP`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)
- [Chrome DevTools Protocol: Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)
- [Chrome DevTools Protocol: Tracing domain](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/)
