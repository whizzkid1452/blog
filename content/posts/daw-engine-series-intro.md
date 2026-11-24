---
title: '[Part 0.] TypeScript DAW 엔진 구현기를 시작하며'
description: '미디 작곡 경험에서 출발해 TypeScript로 DAW 엔진을 만든 이유와 wavesurfer.js, Tone.js, Web Audio API가 맡는 역할의 차이를 설명합니다.'
date: '2026-08-21'
publishedAt: '2026-08-21T11:30:00+09:00'
tags: ['daw', 'audio', 'typescript', 'architecture', 'series']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 0
draft: false
visibility: public
---

보컬 클립을 둘로 나누고 뒷부분만 다음 마디로 옮겼다고 해볼게요. 화면에는 클립 두 개가 보이지만, 편집기는 두 클립이 같은 원본의 어느 구간을 재생하는지 기억해야 해요. 이동을 취소한 뒤 다시 들으면 클립이 원래 타임라인 위치에서 재생돼야 해요. 믹스를 내보낼 때도 현재 클립 배치와 신호 경로를 읽어야 해요.

미디로 곡을 만들 때 익숙했던 이런 편집을 웹에서도 구현하고 싶었어요. 클립 배치와 편집 이력, 믹서 연결을 하나의 프로젝트 모델로 다룰 수 있도록 TypeScript로 DAW 엔진을 만들었습니다.

[DAW Engine 저장소](https://github.com/whizzkid1452/daw-engine) / [설치 및 API 문서](https://github.com/whizzkid1452/daw-engine#readme)

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

## [sort1] 4. wavesurfer.js와 DAW 엔진은 어디에 쓰일까

wavesurfer.js는 브라우저에서 파형을 그리고, 사용자가 파형을 클릭해 원하는 지점부터 소리를 들을 수 있게 해줘요. Regions 플러그인으로 파형 위에 구간을 표시하고, 멀티트랙 확장으로 여러 트랙을 함께 재생하거나 각각의 시작 위치와 볼륨을 조절할 수 있어요. 녹음 내용을 보면서 특정 구간을 찾아 듣는 화면이라면 이 기능들이 바로 필요한 도구예요. [wavesurfer.js 공식 문서](https://wavesurfer.xyz/docs/), [멀티트랙 확장 API](https://wavesurfer-multitrack.pages.dev/docs/classes/default)

제가 엔진에서 맡기고 싶었던 것은 그 조작 이후에 남는 프로젝트 상태였어요. 파형 위에 구간을 표시하면 파일 안에서 어느 부분을 들을지 알 수 있어요. DAW에서 클립을 나누면 원본 파일을 참조하는 두 리전이 생겨요. 각 리전은 원본에서 가져올 구간과 타임라인에 놓일 위치를 따로 기억해서, 뒷부분만 옮기거나 반복해서 배치할 수 있어요.

이동과 분할을 되돌릴 수 있는 편집 명령으로 두면, 드래그와 단축키에서 같은 편집 규칙과 실행 이력을 쓸 수 있어요. 트랙 신호를 리버브 버스로 보낸다면 편집 모델에는 그 연결도 남아요. 그래서 재생 예약과 믹스 출력에 현재 세션의 클립 배치와 라우팅을 전달할 수 있어요. [DAW Engine의 편집 모델과 명령 이력](https://github.com/whizzkid1452/daw-engine#core-concepts)

Web Audio API는 오디오 노드를 연결해 소리를 처리하고 렌더링하는 브라우저 표준이에요. Tone.js는 그 위에서 악기와 이펙트를 구성하고, 박자에 맞춰 이벤트를 예약하는 도구를 제공해요. DAW Engine은 그 실행에 필요한 편집 상태를 관리하고, 앱이 연결한 오디오 백엔드에 전달해요. 덕분에 화면이나 오디오 백엔드를 바꿀 때도 클립 편집 규칙을 재사용할 수 있어요. 실제 재생, 녹음, 렌더링은 앱에서 백엔드를 구현하고 연결하는 작업이 필요해요. [Web Audio API 명세](https://www.w3.org/TR/webaudio-1.0/), [Tone.js 공식 문서](https://tonejs.github.io/), [DAW Engine의 백엔드 경계](https://github.com/whizzkid1452/daw-engine#audio-backend)

## [sort1] 5. 이 시리즈가 다루는 범위

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

## [sort1] 6. 읽는 순서

처음부터 끝까지 따라가려면 Part 번호 순서가 자연스럽다. 관심사만 고르려면 아래 지도를 쓰면 된다.

1. [[Part 1.] 가변 Tempo DAW에서 Frame과 Beat를 어떻게 변환할까](/posts/daw-engine-tempo-map) - 시간 좌표
2. [[Part 2.] Sample Peak만으로 부족해서 Meter DSP를 설계했다](/posts/daw-engine-meter-dsp) - 음량 측정
3. [[Part 3.] Automation은 점을 연결하는 기능이 아니었다](/posts/daw-engine-automation-curve) - 파라미터 곡선
4. [[Part 4.] MIDI 파일은 Note 배열이 아니라 Event Stream이었다](/posts/daw-engine-midi-file-codec) - MIDI 교환
5. [[Part 5.] 오디오 Export는 Encode 한 번으로 끝나지 않았다](/posts/daw-engine-offline-export-pipeline) - 오프라인 파이프라인
6. [[Part 6.] Audio Processor 실행 순서를 DAG로 모델링한 이유](/posts/daw-engine-processing-dag) - 처리 Graph
7. [[Part 7.] boolean으로 표현하지 못한 재생 전환을 상태 머신으로 관리하기](/posts/daw-engine-transport-state-machine) - 재생 전환 제어

다음 글은 가변 Tempo에서 Frame과 Beat가 왜 하나의 공식으로 끝나지 않는지부터 시작한다.

## [sort1] 7. 마치며

DAW를 쓰던 사람이 엔진을 만들면, 처음에는 화면에 보이는 기능을 그대로 옮기려 한다. 실제로 어려운 지점은 기능 목록보다 시간, 신호, 편집 지시가 어떤 계약을 지키며 흐르는가에 있었다.

이 시리즈는 그 계약을 하나씩 고정해 온 기록이다. 완성된 만능 엔진을 선언하지 않는다. 대신 각 글에서 무엇을 선택했고, 무엇이 아직 검증되지 않았는지를 남긴다.

> “좋은 DAW Core는 모든 소리를 내는 코드가 아니라, 소리가 어긋나지 않게 흐르는 규칙을 먼저 정의한다.”
