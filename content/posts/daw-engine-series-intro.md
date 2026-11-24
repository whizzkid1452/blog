---
title: '[Part 0.] TypeScript DAW 엔진 구현기를 시작하며'
description: 'DAW가 무엇인지, 오디오 편집 도메인의 특성, 미디 작곡에서 개발로 이어진 배경, 그리고 이 시리즈가 다루는 엔진 경계를 안내합니다.'
date: '2026-08-21'
publishedAt: '2026-08-21T11:30:00+09:00'
tags: ['daw', 'audio', 'typescript', 'architecture', 'series']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 0
draft: false
visibility: public
---

이 시리즈는 TypeScript로 만든 DAW 엔진의 핵심 설계를 기록한다. Part 1부터는 Tempo Map, Meter, Automation, MIDI, Export, Processing Graph처럼 개별 문제로 바로 들어간다. 그래서 그 앞에, 이 글이 답할 질문을 먼저 둔다.

> DAW는 무엇이고, 이 도메인에서 무엇이 어렵고, 왜 이 엔진을 만들기 시작했는가.

구현 세부보다 지도가 목적이다. 각 Part의 본론은 해당 글로 넘긴다.

이 시리즈에서 소개하는 엔진의 코드와 사용법은 GitHub에서 볼 수 있어요. [DAW Engine 저장소](https://github.com/whizzkid1452/daw-engine) / [README](https://github.com/whizzkid1452/daw-engine#readme)

## [sort1] 1. DAW는 무엇인가

DAW(Digital Audio Workstation) 는 소리를 녹음하고, 편집하고, 섞고, 내보내는 소프트웨어다. GarageBand, Ableton Live, Logic Pro, Cubase 같은 제품이 여기에 속한다.

코딩에 비유하면 DAW는 IDE에 가깝다. 음원과 MIDI 같은 입력 소스를 받아, 트랙, 이펙트, 시간축이라는 도구를 거쳐, 원하는 사운드와 타임라인을 만든다. 화면에는 파형과 노트가 보이지만, 엔진 안에서는 시간 좌표, 버퍼, 이벤트, 파라미터 곡선이 함께 움직인다.

이 시리즈에서 다루는 것은 완성된 DAW 제품 UI 전체가 아니다. 트랙, 리전, 재생, 오프라인 렌더링처럼 오디오 편집의 핵심을 TypeScript 라이브러리로 분리한 DAW Core다. 브라우저는 Web Audio로 소리를 내고, 제품은 React, Electron으로 화면을 붙인다. Core는 그 중간에 편집과 시간과 신호 처리의 도메인 규칙을 둔다.

## [sort1] 2. 이 도메인이 일반 CRUD와 다른 점

오디오 편집은 “값을 저장하고 다시 보여 주기”만으로 끝나지 않는다. 자주 마주치는 특성은 다음이다.

| 특성              | 무엇을 뜻하는가                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- |
| 이중 시간축       | 장치는 Frame(PCM sample)으로 움직이고, 사용자는 Beat, 마디로 생각한다                |
| 비파괴 편집       | 원본 파일을 직접 깎지 않고, 위치, 길이, 이펙트 지시만 바꿔 다시 듣는다                |
| 실시간과 오프라인 | 재생은 낮은 지연이 중요하고, Export는 정확한 후처리 순서가 중요하다                 |
| 상태의 수명       | 재생 FSM, Undo History, Meter 누적값, Graph 의존성은 서로 다른 주기로 변한다        |
| 경계 밖 Backend   | Core가 Web Audio나 Native를 직접 소유하지 않고, 렌더, 재생은 계약으로 위임할 수 있다 |

예를 들어 Tempo가 중간에 바뀌면 `beats * 60 / bpm * sampleRate` 같은 단일 공식은 깨진다. Volume Automation은 점만 저장하면 되지 않고, 점 사이 보간과 재생 중 Write 우선순위가 필요하다. MIDI 파일은 Note 객체가 아니라 Note On/Off 이벤트 스트림이다. Export는 Encode 한 번이 아니라 Normalize → True Peak Limit → Dither → Encode 순서를 지켜야 한다.

이 시리즈의 각 Part는 위 특성 중 하나를 깊게 판 기록이다.

## [sort1] 3. 미디 작곡에서 개발로

나는 미디 시퀀싱과 작곡을 먼저 했다. 공대는 짧게 경험한 뒤 작곡 쪽으로 옮겨 공부했고, 대학원에서는 뉴미디어음악과 사운드 엔지니어링에 더 끌렸다. 무대 자체보다, 입력 소스가 여러 신호 처리 경로를 지나 원하는 소리로 바뀌는 과정이 좋았다.

작곡을 시작하게 된 계기도 DAW였다. 시퀀싱할 때 쓰는 DAW는 코딩의 IDE처럼 느껴졌다. 도구를 조립하고, 흐름을 고치고, 수없이 시도한 끝에 원하던 사운드가 나오면 그 자체로 충분했다.

코딩을 시작하게 된 이유도 비슷했다. 로직을 조립해 하나의 기능을 만드는 일이 작곡과 닮아 있었고, 복잡한 구조와 물리적 한계를 계산과 논리로 맞췄을 때의 감각이 같았다. 처음에는 거의 모르는 상태에서 개발을 독학하며 제품 코드에 붙었고, 그 과정에서 웹 기술로 DAW에 가까운 편집 엔진을 다시 만들고 싶다는 목표가 선명해졌다.

그래서 이 엔진은 “오디오를 다루는 라이브러리 실험”보다, 미디 작곡 때 몸으로 익힌 시간, 신호, 편집 감각을 TypeScript 도메인으로 옮기려는 시도에 가깝다. 나중에 사내 미디어 편집기에 연동할 수 있었던 것도, Core를 UI와 플랫폼에서 분리해 둔 선택과 이어진다.

## [sort1] 4. 이 시리즈가 다루는 범위

현재 글들이 다루는 축은 대략 다음과 같다.

```text
시간 좌표     Tempo Map, Frame ↔ Beat ↔ BBT
측정         Meter DSP, Loudness, True Peak
파라미터 곡선  Automation Point, 보간, Write Mode
교환 포맷     Standard MIDI File 읽기와 쓰기
결과물       Offline Export 파이프라인
실행 순서     Audio Processor DAG
재생 제어     Transport FSM, 비동기 완료 통제
```

반대로 이 시리즈만으로 단정하지 않는 것도 분명히 한다.

- 상용 DAW 수준의 전체 이펙트, 플러그인 호스트
- 모든 MIDI Event의 완전 호환
- Meter, Export, Graph의 표준 적합성 최종 증명
- React 화면 컴포넌트 자체의 구현 세부

### [sort2] 4-1. 라이브러리가 맡는 일과 패키지 구성

같은 음성 클립을 나눠서 일부만 옮길 때, `Source`는 원본 오디오 참조를 유지하고 `Region`은 원본에서 가져올 구간과 타임라인 위치를 기록해요. `Session`은 트랙과 소스, 템포, 마커를 담고, 트랙의 `Playlist`는 리전 배치를, `Route`는 믹서 입출력과 처리 체인을 관리해요.

- 편집 명령은 `{ type, payload }` 형식으로 전달하고 Zod 스키마로 검사해요. 되돌릴 수 있는 명령은 실행 이력에 쌓여요. 도메인 객체를 직접 바꾸는 호출은 해당 이력에 기록되지 않아요.
- 음악 시간은 4분음표당 1,920틱으로 표현하고, `TempoMap`이 박자와 샘플 프레임을 변환해요. 믹서 연결이 바뀌면 엔진은 라우팅 정보를 스냅샷으로 만들어 백엔드에 전달해요.
- 오토메이션 커브와 모드 상태를 다루는 API가 있어요. Read, Write, Touch, Latch, Off를 실제 입력 및 재생에 연결하는 동작은 앱에서 구현해야 해요.
- 세션을 직렬화하면 리전 배치, 라우팅, 소스 참조를 복원할 수 있어요. 프로젝트를 다시 열려면 원본 오디오 파일도 함께 보관해야 해요.

| 패키지 | 담당하는 일 |
| --- | --- |
| [`@daw-engine/core`](https://github.com/whizzkid1452/daw-engine/blob/main/core/README.md) | 편집 모델, 명령과 이력, 세션 저장 및 복원, 오디오 백엔드 인터페이스 |
| [`@daw-engine/ui-utils`](https://github.com/whizzkid1452/daw-engine/blob/main/ui-utils/README.md) | 타임라인 좌표 계산, 파형, 눈금, 가상 스크롤, Canvas 도구 |

앱은 화면과 실제 재생, 녹음, 렌더링을 담당할 오디오 백엔드를 제공해요. 백엔드는 `AudioProvider`를 구현하고 첫 `AudioEngine.getInstance(backend)` 호출에 전달해 연결해요. [AudioProvider 인터페이스](https://github.com/whizzkid1452/daw-engine/blob/main/core/src/audio/AudioProvider.ts)

### [sort2] 4-2. Core를 설치하고 첫 세션 만들기

두 패키지는 npm 레지스트리 게시 전이에요. TypeScript와 ESM을 사용하는 앱의 프로젝트 폴더에서 아래 명령을 실행하면, 특정 Git 커밋에 포함된 Core 빌드와 타입 선언을 설치할 수 있어요.

```bash
npm install 'git+https://github.com/whizzkid1452/daw-engine.git#859e379d869efaaf483d317a062c16775999f97e'
```

Core를 가져와 48 kHz 세션을 만들고 오디오 트랙을 하나 추가해요. 이 예제는 오디오 장치에 연결하기 전에 편집 모델이 만들어지는지 확인하는 단계예요.

```typescript
import { Session, TrackType } from '@daw-engine/core';

const session = new Session('My Song', undefined, 48_000);
const track = session.addTrack('Vocals', TrackType.AUDIO);

session.setTempo(120);

console.log(session.tracks.length, track.name); // 1 Vocals
```

파형과 타임라인 도구도 필요하면 Core를 먼저 빌드한 다음 `ui-utils`를 빌드하고 두 패키지를 앱에 설치해요. 명령과 환경 조건은 공개 README에 정리되어 있어요. [소스 빌드 및 설치](https://github.com/whizzkid1452/daw-engine#installation)

두 패키지의 라이선스는 `GPL-2.0-or-later`예요. [라이선스 원문](https://github.com/whizzkid1452/daw-engine/blob/main/LICENSE)

## [sort1] 5. 읽는 순서

처음부터 끝까지 따라가려면 Part 번호 순서가 자연스럽다. 관심사만 고르려면 아래 지도를 쓰면 된다.

1. [[Part 1.] 가변 Tempo DAW에서 Frame과 Beat를 어떻게 변환할까](/posts/daw-engine-tempo-map) - 시간 좌표
2. [[Part 2.] Sample Peak만으로 부족해서 Meter DSP를 설계했다](/posts/daw-engine-meter-dsp) - 음량 측정
3. [[Part 3.] Automation은 점을 연결하는 기능이 아니었다](/posts/daw-engine-automation-curve) - 파라미터 곡선
4. [[Part 4.] MIDI 파일은 Note 배열이 아니라 Event Stream이었다](/posts/daw-engine-midi-file-codec) - MIDI 교환
5. [[Part 5.] 오디오 Export는 Encode 한 번으로 끝나지 않았다](/posts/daw-engine-offline-export-pipeline) - 오프라인 파이프라인
6. [[Part 6.] Audio Processor 실행 순서를 DAG로 모델링한 이유](/posts/daw-engine-processing-dag) - 처리 Graph
7. [[Part 7.] boolean으로 표현하지 못한 재생 전환을 상태 머신으로 관리하기](/posts/daw-engine-transport-state-machine) - 재생 전환 제어

다음 글은 가변 Tempo에서 Frame과 Beat가 왜 하나의 공식으로 끝나지 않는지부터 시작한다.

## [sort1] 6. 마치며

DAW를 쓰던 사람이 엔진을 만들면, 처음에는 화면에 보이는 기능을 그대로 옮기려 한다. 실제로 어려운 지점은 기능 목록보다 시간, 신호, 편집 지시가 어떤 계약을 지키며 흐르는가에 있었다.

이 시리즈는 그 계약을 하나씩 고정해 온 기록이다. 완성된 만능 엔진을 선언하지 않는다. 대신 각 글에서 무엇을 선택했고, 무엇이 아직 검증되지 않았는지를 남긴다.

> “좋은 DAW Core는 모든 소리를 내는 코드가 아니라, 소리가 어긋나지 않게 흐르는 규칙을 먼저 정의한다.”
