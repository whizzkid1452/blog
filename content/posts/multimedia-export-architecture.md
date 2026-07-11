---
title: '[Part 1] 브라우저에서 멀티미디어 export하기- 문제 정의와 아키텍처 설계'
description: '브라우저 기반 멀티미디어 에디터에서 MP4 export를 구현하기 위해 문제를 정의하고 아키텍처를 설계한 과정을 정리합니다.'
date: '2026-04-13'
publishedAt: '2026-04-13T19:28:05+09:00'
tags: ['export', 'webcodecs', 'architecture', 'multimedia']
draft: false
---

시리즈: 브라우저에서 멀티미디어 export하기

- [Part 1] 문제 정의와 아키텍처 설계 ← 현재 글
- [Part 2] 공간적 합성과 시간적 합성 - 공간적 합성과 시간적 합성

## 들어가며

회사에서 요즘 만들고 있는 Studio 페이지는 브라우저에서 동작하는 멀티미디어 에디터다. 사용자가 비디오 위에 텍스트를 올리고, 오디오를 편집하고, 이미지를 배치한 뒤 "Export" 버튼을 누르면 MP4 파일이 다운로드된다.

사용자 입장에서는 버튼 하나. 근데 그 버튼 하나 뒤에 몇 주 동안의 삽질이 있었다. 텍스트를 비디오 위에 어떻게 그릴지, 오디오 클립 여러 개를 어떻게 한 줄로 합칠지, 이걸 서버 없이 브라우저 안에서 어떻게 다 처리할지 — 생각보다 만만치 않은 문제였다.

이 글은 그 과정에서 겪은 의사결정의 흐름을 정리한 기록이다. "처음엔 이렇게 생각했는데, 이래서 안 됐고, 결국 이렇게 바꿨다"는 식의 과정 중심으로, 최종적으로 어떤 아키텍처에 도달했는지까지 이야기해보려 한다.

## 1. export 아키텍쳐 시스템 설계

### 1-1. 전혀 다른 세 가지 세계를 하나로 합쳐야 한다

Export 시스템을 설계하기 전에, 먼저 "합쳐야 할 것이 정확히 뭔지"부터 정리해봤다. 그랬더니 하나의 불편한 진실이 보였다. 텍스트, 오디오, 비디오는 근본적으로 다른 종류의 데이터라는 거다.

생소한 용어가 좀 나오니까 간단히 풀어보겠다.

- 벡터 데이터 — 텍스트는 "A"라는 글자를 그릴 때 점과 선의 좌표로 모양을 표현한다. 아무리 확대해도 안 깨진다. 실체는 "48px Bold, 흰색, (100, 200) 좌표"같은 수학적 명령의 집합이다.
- PCM(Pulse Code Modulation) — 쉽게 말해 소리를 숫자로 바꾼 것이다. 마이크로 들어온 아날로그 음파를 초당 48,000번(48kHz) 찍어서 각 순간의 음압을 숫자(0.37, -0.12, 0.85…)로 기록한다. 이 숫자 배열이 오디오의 원본 데이터다.
- 시간축 기반 — 오디오는 처음부터 끝까지 시간 순서대로 흘러가는 데이터다. "0초부터 3.5초까지의 소리"처럼, 항상 시간이라는 축 위에 올라가 있다.
- 래스터 프레임 — 비디오는 결국 사진(프레임)의 연속이다. 각 프레임은 픽셀 격자(래스터)로 이루어져 있고, 1920×1080 해상도면 한 프레임에 약 200만 개의 픽셀, 30fps면 1초에 이런 이미지가 30장 필요하다.
- seek 기반 — 오디오처럼 순차 재생이 아니라, "1.4초 시점의 화면 보여줘"처럼 원하는 시점으로 직접 점프(seek)해서 해당 프레임을 꺼내오는 방식이다.

결국 핵심은 이거다. 텍스트는 공간(x, y 좌표)에 살고, 오디오는 시간(초, 밀리초)에 살고, 비디오는 공간과 시간 양쪽 모두에 살고 있다. 이 세 축이 다른 데이터를 한 파일로 합치는 것, 그게 이 문제의 본질이었다.

### 1-2. 서버에서 처리하기 어려운 이유

처음에는 단순하게 접근했다. 미디어를 서버로 올리고, 서버에서 FFmpeg으로 합성하면 끝 아닌가. FFmpeg은 거의 모든 영상 처리를 해낼 수 있으니까.

근데 두 가지 이유로 접었다.

첫째, 프라이버시. 사용자의 비디오와 오디오를 서버로 전송해야 한다. 민감한 콘텐츠일 수 있다. "제 파일 어디로 가나요?"라는 질문에 "저희 서버에 올라갑니다"라고 답하고 싶지 않았다.

둘째, 비용. 여기서 비용이라 함은 인코딩 비용을 말하는 거다.

잠깐, **인코딩(Encoding)**이 뭔지 짚고 가자. 원본 미디어를 특정 형식으로 압축·변환하는 과정이다. 반대로 **디코딩(Decoding)**은 압축된 데이터를 원래 형태로 복원하는 과정이고.

인코딩이 왜 이렇게 무거운 작업인가?

영상을 인코딩한다는 건, 매 프레임(초당 30장)마다 "이전 프레임이랑 뭐가 달라졌지?" 를 찾아내고, 그 차이를 최소한의 데이터로 표현하는 복잡한 수학 연산을 반복하는 거다. H.264 같은 코덱은 움직임 추정(motion estimation), 이산 코사인 변환(DCT), 엔트로피 코딩 등 여러 단계를 밟는다.

10분짜리 1080p 영상이면 프레임만 18,000장이다. 프레임당 200만 픽셀, 각 픽셀에 대해 이전 프레임과의 차이를 계산. 이게 CPU(혹은 GPU)를 오래 붙잡는 이유다.

이걸 서버에서 돌리면? 사용자 100명이 동시에 Export를 누르는 순간 서버가 인코딩 100개를 동시에 처리해야 한다. AWS에서 인코딩용 인스턴스 띄우면 시간당 수 달러씩 나간다. 사용자 수에 비례해서 비용이 뻥 뛴다.

결론: 클라이언트 사이드에서 처리하자. 사용자 브라우저가 자기 컴퓨터의 CPU/GPU로 인코딩하면 서버 비용은 0이다.

### 1-3. 브라우저에서 비디오 생성하기

클라이언트로 방향을 정하고 나니 또 다른 벽에 부딪혔다. 브라우저에는 "여러 미디어를 합성해서 비디오 파일로 출력"하는 단일 API가 없다. 영상을 "재생"하는 건 되지만, "만드는" 건 사정이 좀 다르다.

여기서 두 가지 선택지를 놓고 고민했다.

선택지 A: FFmpeg을 WASM으로 빌드해서 브라우저에서 돌리기

FFmpeg을 WebAssembly(WASM)로 컴파일하면 브라우저에서 실행할 수 있다. ffmpeg.wasm이라는 프로젝트가 이미 존재한다. 하지만 고민이 있었다.

- WASM 바이너리가 ~30MB다. 추가적인 다운로드가 필요하다.
- WASM은 CPU만 쓴다. GPU 하드웨어 인코더를 활용할 수 없으니 속도가 느리다.
- 메모리 제한. 브라우저 WASM 메모리 한도(보통 2~4GB) 안에서 모든 미디어를 처리해야 한다.

선택지 B: 브라우저 내장 API 조합

2022년부터 Chrome에 WebCodecs API가 들어왔다. 브라우저에 내장된 하드웨어 인코더/디코더를 JavaScript에서 직접 호출할 수 있게 해주는 API다. WASM 다운로드 없이 GPU 가속까지 가능하다.

다만 WebCodecs는 "인코딩"만 해준다. 프레임을 그리는 건 Canvas API, 오디오를 합치는 건 Web Audio API, 인코딩된 데이터를 파일로 묶는 건 별도의 라이브러리가 필요하다. 결국 여러 API를 끼워맞춰서 파이프라인을 직접 구축해야 한다.

파이프라인(Pipeline)이란?

공장의 조립 라인을 떠올리면 된다. 원자재가 들어와서 여러 공정을 차례로 거치며 최종 제품이 나온다. 우리의 Export 파이프라인은 "원본 미디어 → 프레임 합성 → 인코딩 → 파일 패키징 → 다운로드"라는 흐름을 따른다. 각 공정은 앞 공정의 출력을 입력으로 받아 가공한다.

당시에는 선택지 B를 골랐다. 조합의 복잡도는 높지만, 30MB 다운로드가 없고 하드웨어 가속을 쓸 수 있다는 게 결정적이었다. 다만 WebCodecs가 Chrome/Edge에서만 지원된다는 제약이 있었는데, 이 부분때문에 결과적으로는 Part 3에서 FFmpeg WASM을 폴백으로 다시 도입하게된다.

### 1-4. 프리뷰와 Export 결과가 달라지면 안 된다

마지막으로 놓칠 수 없는 문제가 하나 더 있었다.

에디터에서 사용자가 실시간으로 보는 화면을 **프리뷰(Preview)**라고 부른다. 에디터 한가운데 있는 미리보기 영역으로, 비디오 위에 텍스트를 올리거나 이미지를 배치하면 그 결과가 바로바로 여기에 반영된다. Export 전에 "결과물이 어떻게 나올지" 확인하는 창이다.

사용자는 당연히 프리뷰에서 본 것과 똑같은 결과가 Export되길 기대한다. 근데 만약 프리뷰용 렌더링 코드와 Export용 렌더링 코드를 따로 만들면 어떻게 될까?

처음에는 "프리뷰 코드 복사해서 Export 버전 만들면 되지 뭐"라고 생각했다. 하지만 금방 이게 시한폭탄이라는 걸 깨달았다. 자세한 이야기는 뒤에서 하겠지만, 미리 결론만 말하면: 두 코드는 시간이 지나면서 반드시 달라진다. 아무리 처음에 같은 코드를 복사해놨더라도.

## 2. 차원으로 분리하기

한참 고민하다가 하나 떠오른 게 있다.

> "텍스트 + 오디오 + 비디오를 합친다"를 한 덩어리로 풀려니까 복잡한 거다. 이걸 합성(Composition)이 일어나는 차원 기준으로 쪼개면 어떨까?

관심사의 분리(Separation of Concerns)는 소프트웨어 설계의 핵심 원칙이다. 하나의 복잡한 문제를 독립적인 작은 문제 여러 개로 나누고, 각각을 따로 해결한 뒤 조합하는 방식이다. 각 부분을 독립적으로 이해하고 수정하고 테스트할 수 있게 된다.

분석해보니 합성이 세 가지 차원에서 일어나야 했다.

단계 1: 공간적(Spatial) 합성

"이 프레임에 뭐가 어디에 그려지느냐"의 문제다. 비디오가 배경에 깔리고, 그 위에 이미지가 올라가고, 맨 위에 텍스트가 찍힌다. 포토샵 레이어를 생각하면 된다. X/Y 좌표, 크기, 투명도, 순서를 다룬다.

단계 2: 시간적(Temporal) 합성

"이 시점에 어떤 소리가 들리느냐"의 문제다. BGM이 0초부터 끝까지 깔리고, 나레이션이 3초에 시작해서 10초에 끝나고, 효과음이 5.2초에 딱 한 번 터진다. 각 오디오 클립을 타임라인 위에 정확히 배치하고, 겹치는 소리를 합치는(믹싱하는) 작업이다.

단계 3: 스트림(Stream) 합성

"합성된 비디오 데이터와 오디오 데이터를 하나의 파일에 담는" 작업이다. MP4 파일 내부를 들여다보면 비디오 스트림과 오디오 스트림이 분리되어 저장되어 있다. 이 두 스트림을 시간에 맞춰 정렬하고 하나의 컨테이너로 묶는 것이 스트림 합성이며, 이 작업을 수행하는 도구를 **Muxer(먹서)**라고 부른다.

Muxer? Multiplexer의 줄임말로, 여러 데이터 스트림을 하나의 컨테이너에 합쳐주는 도구다. 반대로 Demuxer는 하나의 파일에서 비디오/오디오 스트림을 분리한다. MP4 파일을 재생할 때 플레이어가 내부적으로 하는 게 바로 Demuxing이다.

이렇게 나누고 보니, 각 단계에 딱 맞는 브라우저 API가 눈에 들어왔다.

## 3. 전체 아키텍처

### 3-1. 첫 번째 시도: "그냥 한 함수에서 다 하면 되지 않나?"

차원을 분리하는 건 좋았다. 근데 이걸 코드로 어떻게 구현하지? 가장 단순한 접근은 `exportVideo()`라는 하나의 거대한 함수에 다 때려넣는 거다.

```ts
function exportVideo() {
  // 1. UI에서 포맷 받기
  // 2. Store에서 레이어 데이터 가져오기
  // 3. 오디오 믹스다운
  // 4. 프레임 렌더링 루프
  // 5. 인코딩
  // 6. Muxing
  // 7. 다운로드
  // 8. 진행률 업데이트
  // ... 500줄짜리 함수
}
```

실제로 처음엔 이렇게 짰다. 금방 문제가 보였다.

- 문제 1: 오디오만 Export할 때도 전체 파이프라인을 태워야 한다. WAV로 내보내는데 Canvas 프레임 루프를 돌릴 이유가 없다. 근데 한 함수에 다 들어있으니 분리할 수가 없다.
- 문제 2: 진행률 표시 위치가 모호해진다. 인코딩 로직 한가운데서 `setProgress()`를 호출하면 엔진 코드가 UI 상태에 직접 의존하게 된다. 인코딩 로직만 떼어내서 테스트하거나 재사용하는 게 불가능해진다.
- 문제 3: 변경이 전파된다. ExportDialog 버튼 텍스트 하나 바꾸고 싶을 뿐인데, 500줄짜리 함수를 열어서 관련 부분을 찾아야 한다. UI 변경이 인코딩 코드와 같은 파일에 있으니, 실수로 인코딩 로직을 건드릴 위험도 생긴다.

### 3-2. "그러면 어떤 기준으로 나눠야 하지?"

한 발 물러서서 생각해봤다. 변경의 이유가 다른 것들을 묶으면 안 된다.

| 변경 요청                               | 영향 범위                |
| --------------------------------------- | ------------------------ |
| "Export 버튼을 파란색으로 바꿔줘"       | UI만 변경                |
| "MP4 대신 WebM도 지원해줘"              | 인코딩 엔진 변경         |
| "진행률 바를 더 세밀하게 보여줘"        | UI + 오케스트레이션 변경 |
| "오디오 믹스다운 로직을 개선해줘"       | 엔진만 변경              |
| "Export 시작 전에 해상도 옵션 추가해줘" | UI + 오케스트레이션 변경 |

패턴이 보였다. 변경 이유가 크게 세 가지로 나뉜다.

- "보여주는 것"을 바꿀 때 — UI만 수정
- "처리하는 방식"을 바꿀 때 — 인코딩/합성 엔진만 수정
- "무엇을 언제 처리할지"를 바꿀 때 — 데이터 수집과 흐름 조율 수정

단일 책임 원칙(Single Responsibility Principle)은 "모듈은 변경의 이유가 하나여야 한다"는 원칙이다. 여기서 '변경의 이유'란 이 코드를 수정하게 만드는 요구사항의 종류를 말한다. UI 변경과 인코딩 로직 변경은 다른 종류의 요구사항이므로, 같은 모듈에 있으면 안 된다.

### 3-3. 세 계층의 탄생

이 분석에서 자연스럽게 세 계층이 나왔다. 처음부터 "계층 아키텍처를 적용하자"고 정한 게 아니라, 변경의 이유를 분석하다 보니 결과적으로 계층이 된 거다.

계층 아키텍처(Layered Architecture)는 시스템을 책임별로 수평적인 층으로 나누는 설계 패턴이다. 상위 계층은 하위 계층을 사용하지만, 하위 계층은 상위 계층을 모른다. 각 계층을 독립적으로 변경할 수 있다는 게 핵심이다. UI 디자인을 바꿔도 인코딩 로직은 영향받지 않는 구조.

여기서 중요한 설계 결정이 하나 있다. Engine Layer는 Zustand Store를 모른다. Engine은 `usePreviewStore`나 `useAudioEditorStore`를 import하지 않는다. 필요한 데이터는 전부 Orchestration Layer가 수집해서 순수 데이터(`layers`, `mediaFiles`, `textData`, `audioBuffer`)로 넘겨준다.

이렇게 설계한 이유는, Engine이 Store에 직접 접근하는 순간, Engine을 테스트하거나 다른 곳에서 재사용할 때 항상 Zustand Store가 필요해진다. 이 함수 호출하려면 React 앱 전체를 셋업해야 하는 거다. 순수 데이터만 넘기면, 테스트할 때 목(mock) 데이터만 넣으면 된다.

의존성 역전 원칙(Dependency Inversion Principle)은 "상위 모듈이 하위 모듈에 의존하지 말고, 둘 다 추상화에 의존해야 한다"는 원칙이다. 여기서는 Engine이 Store라는 구체적인 구현에 의존하는 대신, `onProgress` 콜백과 순수 데이터 인터페이스(`VideoExportPipelineParams`)라는 추상화에 의존한다. Engine은 "누가 나를 호출하는지" 몰라도 된다.

### 3-4. 이 구조로 얻은 것

각 계층이 독립적으로 변경 가능해졌다.

| 변경 요청                   | 수정 범위                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| "Export 버튼 색 변경"       | `ExportDialog.tsx`만 수정                                                                          |
| "WebM 코덱 추가"            | `videoExportPipeline.ts`만 수정                                                                    |
| "해상도 옵션 추가"          | `ExportDialog.tsx` + `useVideoExport.ts`                                                           |
| "오디오 믹스 알고리즘 변경" | `useVideoExport.ts`의 믹스다운 부분만                                                              |
| "FFmpeg 폴백 추가"          | `ffmpegExportPipeline.ts` 새로 생성 + `useVideoExport.ts`에 분기 추가 (ExportDialog는 변경 불필요) |

특히 FFmpeg 폴백을 추가할 때 이 구조의 가치가 빛났다. `videoExportPipeline.ts`와 동일한 인터페이스(`VideoExportPipelineParams`)를 받는 `ffmpegExportPipeline.ts`를 만들고, Orchestration에서 분기만 추가하면 됐다. UI나 오디오 믹스다운 코드는 한 줄도 안 건드렸다.

### 3-5. 최종 계층 구조

정리하면, 시스템은 세 계층으로 나뉜다.

- UI Layer — 사용자에게 포맷 선택 화면과 진행률 바를 보여준다.
- Orchestration Layer — 여러 Store에서 데이터를 모으고, Engine에 넘기고, 진행 상태를 갱신하는 지휘자 역할이다.
- Engine Layer — 실제로 무거운 작업(인코딩, 합성)을 수행한다. 브라우저 API와 라이브러리가 여기에 속한다.

drop-daw란?

직접 만든 오디오 DAW(Digital Audio Workstation) 엔진 라이브러리다. DAW는 음악을 녹음·편집·믹싱하는 소프트웨어(GarageBand, Ableton Live 같은 것)를 말하는데, drop-daw는 이 DAW의 핵심 기능 — 트랙, 리전, 재생, 오프라인 렌더링 — 을 브라우저에서 사용할 수 있도록 구현한 JavaScript 라이브러리다. Voix Studio의 오디오 편집과 오디오 Export를 담당하고 있다.

### 3-6. 후속 변경 - 오디오 믹스다운의 통합

이 아키텍처를 운영하면서 한 가지 수정이 있었다. 초기에는 비디오 Export(`useVideoExport.ts`)에서 오디오 믹스다운을 Orchestration Layer 안에 직접 구현했었다. `OfflineAudioContext`를 생성하고, 리전을 스케줄링하는 40줄짜리 코드가 `useVideoExport.ts` 안에 있었다.

이건 위 다이어그램에서 Orchestration Layer가 Engine Layer의 책임을 침범한 거다. "오디오를 어떻게 합치는가"는 Engine의 책임인데, Orchestration이 직접 Web Audio API를 호출하고 있었다.

더 큰 문제는, 이 중복 코드가 오디오 Export 경로의 믹스다운과 달랐다는 것이다. 오디오 Export는 `WebAudioProvider.exportAudio()`를 통해 트랙 볼륨/패닝/뮤트/솔로/마스터 게인이 반영된 그래프로 렌더링하는데, 비디오 Export의 중복 코드에는 이것들이 빠져 있었다. 결과적으로 "오디오 Export와 비디오 Export의 오디오가 다르다"는 버그가 존재했다.

수정 후, 비디오 Export에서도 `backend.exportAudio()`를 호출하도록 바꿨다. 이제 두 경로 모두 동일한 함수를 공유하며, 위 다이어그램의 Engine Layer에 오디오 믹스다운이 올바르게 위치한다. Part 2의 5-6절에서 이 과정을 상세히 다룬다.

다음 글에서는 3단계 합성 중 앞의 두 단계, Canvas로 프레임을 합성하고 오디오를 믹스다운하는 과정을 구체적인 코드와 함께 다뤄보겠다.

다음 편: [[Part 2] 공간적 합성과 시간적 합성](https://insight74278.tistory.com/14)

## 참고

MDN / W3C 공식 문서

- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)
- [Using Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API)
- [WebCodecs best practices](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
- [WebCodecs explainer](https://github.com/w3c/webcodecs/blob/main/explainer.md)
- [WebCodecs samples](https://w3c.github.io/webcodecs/samples/)
- [Can I use WebCodecs](https://caniuse.com/webcodecs)

라이브러리

- [mediabunny](https://github.com/Vanilagy/mediabunny)
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [ffmpeg.wasm docs](https://ffmpegwasm.netlify.app/docs/overview/)

블로그 / 튜토리얼

- [ffmpeg webassembly](https://blog.scottlogic.com/2020/11/23/ffmpeg-webassembly.html)
- [Real-time video filters in browsers with FFmpeg and WebCodecs](https://transloadit.com/devtips/real-time-video-filters-in-browsers-with-ffmpeg-and-webcodecs/)
- [Introduction to the WebCodec API](https://dev.to/ethand91/introduction-to-the-webcodec-api-real-time-video-encoding-and-display-1b54)
- [Web Audio gist](https://gist.github.com/chrisguttandin/e49764f9c29376780f2eb1f7d22b54e4)
