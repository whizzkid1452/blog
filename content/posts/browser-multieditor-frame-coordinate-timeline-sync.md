---
title: '[Part 3.] 웹브라우저 멀티에디터 만들기 - 프레임 좌표계를 이용한 멀티미디어 타임라인 동기화'
description: '프레임 좌표계를 기준으로 멀티미디어 타임라인과 도메인 상태를 동기화한 설계 과정을 정리합니다.'
date: '2026-04-13'
publishedAt: '2026-04-13T20:33:51+09:00'
tags: ['architecture', 'timeline', 'multimedia', 'editor']
series:
  name: '웹브라우저 멀티에디터 만들기'
  order: 3
draft: false
---

<details>
<summary>목차 펼쳐보기</summary>

- [1. 타임라인 위치와 미디어 출력을 나누었다](#타임라인-위치와-미디어-출력을-나누었다)
- [2. 오디오 샘플 프레임을 공통 시간 좌표로 사용했다](#오디오-샘플-프레임을-공통-시간-좌표로-사용했다)
- [3. 미디어별 위치를 같은 단위로 저장했다](#미디어별-위치를-같은-단위로-저장했다)
- [4. 엔진 시간을 기준으로 출력 경로를 맞췄다](#엔진-시간을-기준으로-출력-경로를-맞췄다)
- [5. 가져오기와 Undo도 하나의 편집 흐름으로 묶었다](#가져오기와-undo도-하나의-편집-흐름으로-묶었다)
- [6. 적용 결과와 확인할 기준](#적용-결과와-확인할-기준)

</details>

<details>
<summary>시리즈 전체 글 바로가기</summary>

1. [Part 1. 웹브라우저 멀티에디터 만들기 - 아키텍처 설계](/posts/browser-multieditor-architecture-design)
2. [Part 2. 웹브라우저 멀티에디터 만들기 - 아키텍처 설계 변화](/posts/browser-multieditor-architecture-change)
3. [Part 3. 웹브라우저 멀티에디터 만들기 - 프레임 좌표계를 이용한 멀티미디어 타임라인 동기화](/posts/browser-multieditor-frame-coordinate-timeline-sync)

</details>

영상, 오디오, 이미지, 텍스트를 한 타임라인에 올리려면 같은 위치가 모든 미디어에서 같은 시간을 뜻해야 한다. VOIX STUDIO의 웹 에디터를 만들면서, 미디어별 타임라인을 따로 두는 대신 `daw-engine`의 Region과 공통 시간 좌표를 재사용했다.

[이전 글](/posts/browser-multieditor-architecture-change)에서는 제품의 조율 계층과 편집 코어의 경계를 정했다. 이번 글은 그 경계 안에서 **서로 다른 미디어를 같은 시간축에 배치하고 출력하는 방법**을 다룬다.

## [sort1] 1. 타임라인 위치와 미디어 출력을 나누었다

Region은 원본 미디어의 일부를 타임라인 어디에서 얼마나 사용할지 나타내는 편집 단위다. 오디오 Region은 소스의 오디오 버퍼를 참조하고, 재생 런타임이 소리를 출력한다.

이미지와 텍스트에는 오디오 버퍼가 없다. 그렇다고 별도 타임라인을 만들 필요는 없었다. 시작 위치와 길이는 공통 편집 코어에서 관리하고, 그 시간에 무엇을 출력할지는 제품의 미디어별 연결에서 결정할 수 있기 때문이다.

영상도 같은 기준으로 다룬다. 영상에서 추출한 오디오는 오디오 경로로 재생하고, 영상 프레임은 미리보기 경로에서 표시한다.

## [sort1] 2. 오디오 샘플 프레임을 공통 시간 좌표로 사용했다

엔진의 Session은 프로젝트의 sample rate를 공유한다. 이 글에서 Frame은 비디오의 한 장면이 아니라 **오디오 샘플 프레임을 기준으로 한 시간 좌표**다. 예를 들어 sample rate가 44,100Hz이면 1초는 44,100 Frame이다.

```text
sampleRate = 44100
1초   = 44100 Frame
2.5초 = 110250 Frame
```

아래 코드는 초와 Frame의 변환을 보여주는 예제다. 실제 제품의 전체 시간 타입과 입력 검증은 생략했다.

```ts
function secondsToFrames(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

function framesToSeconds(frames: number, sampleRate: number): number {
  return frames / sampleRate;
}
```

정수 Frame을 쓰면 편집 위치를 같은 시간 해상도로 비교할 수 있다. 모든 초 단위 값을 손실 없이 표현한다는 뜻은 아니다. 변환할 때 샘플 프레임 해상도로 반올림되며, 비디오 프레임률과의 변환도 별도로 필요하다.

## [sort1] 3. 미디어별 위치를 같은 단위로 저장했다

같은 sample rate를 사용하면 이미지와 텍스트도 오디오와 같은 좌표로 배치할 수 있다.

```text
44,100Hz Session의 배치 예시

오디오: 시작 0 Frame,      길이 132300 Frame → 0초부터 3초
비디오: 시작 0 Frame,      길이 441000 Frame → 0초부터 10초
이미지: 시작 132300 Frame, 길이 220500 Frame → 3초부터 5초간
텍스트: 시작 0 Frame,      길이 88200 Frame  → 0초부터 2초
```

UI에서는 Frame을 초나 화면 픽셀로 바꿔 표시한다. 사용자의 이동·자르기 요청은 다시 공통 시간 단위로 변환해 편집 Command에 전달한다. 좌표 변환과 문서 변경을 한 경계에서 연결해야 미디어별로 반올림 규칙이 달라지는 일을 줄일 수 있다.

Region의 위치와 원본에서 읽을 위치도 구분한다. 타임라인 10초에 놓인 클립이 원본 영상의 30초 구간을 사용할 수 있으므로, 미리보기와 내보내기 모두 이 두 좌표를 해석해야 한다.

## [sort1] 4. 엔진 시간을 기준으로 출력 경로를 맞췄다

오디오 재생과 화면 갱신의 실행 주기는 같지 않다. 오디오는 AudioProvider를 통해 Web Audio API에 재생 시점을 예약하고, 화면은 rAF에서 엔진의 현재 시간을 읽어 갱신한다.

```text
공통 재생 시간
├── 오디오: 예약된 AudioBufferSourceNode에서 출력
├── 비디오: 소스 시간으로 변환해 영상 프레임 표시
├── 이미지: Region 활성 구간에서 drawImage
└── 텍스트: Region 활성 구간에서 텍스트 표시
```

초기 구현에서는 현재 시간을 제품 Store로 전달해 화면이 참조하도록 했다. 프레임마다 필요한 값을 모두 React state로 전달할 필요는 없다. Canvas처럼 직접 그리는 화면에는 Signal과 rAF로 갱신을 전달할 수 있다.

공통 좌표는 시간 해석의 기준을 맞춘다. 실제 디코딩 지연, 비디오 seek 지연, 화면 프레임 누락까지 없애지는 않는다. 타임라인의 좌표 정합성과 재생 출력의 지연은 별도로 검증해야 한다.

## [sort1] 5. 가져오기와 Undo도 하나의 편집 흐름으로 묶었다

비디오 가져오기는 파일 하나를 추가하는 작업처럼 보이지만, 영상 트랙과 오디오 트랙, Region, 미리보기 데이터가 함께 등록될 수 있다. 이를 각각 독립적인 편집으로 기록하면 한 번의 Undo로 일부 데이터만 제거될 수 있다.

그래서 코어의 Command와 Transaction을 사용해 복합 편집의 이력 단위를 맞췄다. 제품 Adapter는 미디어 준비와 코어 등록을 연결하고, 오디오 런타임의 버퍼와 디코더는 문서 이력과 별도로 수명을 관리한다.

가져오기 도중 프로젝트가 바뀌는 상황도 확인해야 한다. 늦게 끝난 디코딩 결과를 새 프로젝트에 반영하지 않는 경계는 [Runtime Scope 글](/posts/runtime-scope-project-race-condition)에서 다룬다.

## [sort1] 6. 적용 결과와 확인할 기준

별도 타임라인을 미디어별로 만들지 않고, 공통 Region 좌표 위에서 출력만 분기하는 구조를 적용했다. 개인 개발한 `daw-engine`을 제품 Adapter 뒤에 연결해 웹과 Electron 제품에서 편집 코어를 재사용했다. 이 글에서는 재생 오차나 처리 시간의 정량 개선을 주장하지 않는다.

- [ ] 오디오 샘플 Frame과 비디오 Frame을 구분했는가.
- [ ] UI, 미리보기, 내보내기가 같은 시간 변환 규칙을 사용하는가.
- [ ] 타임라인 위치와 원본 소스 위치를 구분했는가.
- [ ] 복합 가져오기를 하나의 Undo/Redo 단위로 다루는가.
- [ ] 재생 지연과 문서 좌표의 정합성을 별도로 확인하는가.

서로 다른 미디어를 연결할 수 있었던 이유는 위치와 출력의 책임을 나눴기 때문이다. 공통 코어에는 편집 좌표와 규칙을 두고, 제품과 런타임이 그 시간의 출력을 맡게 했다.

## 참고

- [DAW Engine 저장소](https://github.com/HURRAEY/daw-engine)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioBufferSourceNode.start()](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)
