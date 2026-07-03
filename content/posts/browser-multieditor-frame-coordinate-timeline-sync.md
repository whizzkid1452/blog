---
title: '[Part 2.] 웹브라우저 멀티에디터 만들기 - 프레임 좌표계를 이용한 멀티미디어 타임라인 동기화'
description: '프레임 좌표계를 기준으로 멀티미디어 타임라인과 도메인 상태를 동기화한 설계 과정을 정리합니다.'
date: '2026-07-02'
publishedAt: '2026-07-02T15:47:43+09:00'
tags: ['architecture', 'timeline', 'multimedia', 'editor']
draft: false
---

관련 글: [Part 1] 웹브라우저 멀티에디터 만들기 - 아키텍처 설계  
[https://insight74278.tistory.com/19](https://insight74278.tistory.com/19)

이전 글 요약

이전 글 [Part 2.] 웹브라우저 멀티에디터 만들기 - 아키텍쳐 설계 변화([https://insight74278.tistory.com/20](https://insight74278.tistory.com/20))에서는 타임라인 기능을 구현하면서 기존 아키텍처를 크게 수정한 과정을 다뤘다. 타임라인이 모든 도메인의 시간 정보를 횡단해야 하는 수평적 관심사라는 점을 발견하고, 이를 위해 Session Layer라는 새로운 수평 계층을 추가했다. 또한 프랙탈 폴더 구조 대신 레이어 기반 MVC 구조를 채택하여, 폴더 이름만으로도 아키텍처의 의도가 드러나도록 했다. 최종적으로 Presentation, Component, Business, Session, Store, Engine의 6계층 구조가 확정되었다.

아키텍쳐에 이어 멀티미디어 에디팅에 또 하나의 중요한 과제인 타임라인에 대해 어떻게 설계하게되었는지 이야기를 공유해보고 싶다.

## 1. 타임라인이란?

타임라인 작업이 까다로운이유는, 비디오, 음원, 이미지, 텍스트를 비롯한 다양한 기능들의 정보를 모두 알고있는 특수한 컴포넌트이기 때문이다. 지난 글에서 결론적으로 Session Layer 를 추가하며 모든 도메인을 횡단하는 레이어를 추가하게 된 이유도, 이 타임라인 기능때문이었다. (참고: [https://insight74278.tistory.com/20](https://insight74278.tistory.com/20))

[https://www.veed.io/edit/](https://www.veed.io/edit/)

타임라인은 동영상 편집 프로그램에서 비디오 클립을 배열하고 적용할 편집 내용을 계획하는 영역입니다. 처음부터 끝까지 모든 비디오 클립, 오디오 클립, 효과 및 전환 효과가 시간 순서대로 표시되어 작업 과정을 확인할 수 있습니다. 클립 순서를 바꾸거나, 자르거나, 품질을 개선하는 등 기본적인 동영상 편집 작업 을 모두 수행할 수 있습니다 . 또한 타임라인의 어느 지점에서든 프로젝트를 재생하여 편집 결과가 어떻게 보일지 미리 확인할 수 있습니다.  
출처: [https://www.adobe.com/kr/creativecloud/video/discover/video-timeline.html#](https://www.adobe.com/kr/creativecloud/video/discover/video-timeline.html#)

사실 이 프로젝트에서는 기존에 만들어두었던 drop-ai/core 라는 웹브라우저용 daw 엔진 라이브러리와, daw의 뷰포트, 파형, 타임라인을 Canvas 위에 올리기 위한 계산 엔진인 drop-ai/ui-utils 를 이용하여서, 타임라인 제작에 대한 상세한 내용보다는 각기 다른 미디어 타입을 어떻게 타임라인에 동기화 하였는지에 대한 내용을 기술하려고 한다. (타임라인 제작에 대한 내용은 추후 drop.ai 프로젝트에 대한 글에서 다루도록 하겠다.)

## 2. 오디오가 아닌 것들도 타임라인으로 제어할 수 있을까?

현재 프로젝트에서는 앞서 말한 drop-ai/core 의 Session이 데이터의 단일 소스이고, signal 구독을 통해 Canvas UI를 갱신하며, Zustand가 에디터의 UI 상태를 관리한다. 여기서 Session의 Region은 'sourceId'로 AudioBuffer를 참조하고, WebAudioProvider가 그 버퍼를 'AudioBufferSourceNode'로 스케쥴링 해서 소리를 낸다.

하지만 이미지, 텍스트는 AudioBuffer가 없다. sourceId로 참조할 소리 데이터가 없다. (video 의 경우에는 import 단계에서 오디오를 추출해서 영상과 시간을 동기화 하는 방식으로 트랙에 표현하고있다.) 그렇다고 이미지와 텍스트를 위해 별도의 타임라인 시스템을 만들면, 모든 미디어가 하나의 시간축 위에서 동기화되어야한다는 멀티미디어 에디터의 핵심 요구사항이 깨지게된다.

```text
오디오기반 타임라인 설계의 흐름:
Region.sourceId → AudioBuffer → AudioBufferSourceNode → 스피커

이미지의 흐름:
Region.sourceId → ???  (AudioBuffer가 없다)
```

가장 이상적인 방법은, 소리를 내지 않는 미디어들도 drop-ai/core의 region으로 표현하는 것이다. 과연 그것이 가능할까?

## 3. Region의 특성

출처: [https://support.apple.com/ko-kr/guide/logicpro-ipad/lpip1093bde1/ipados#](https://support.apple.com/ko-kr/guide/logicpro-ipad/lpip1093bde1/ipados#)

리전은 프로젝트의 기본 구성요소입니다. 악기를 녹음하거나, 루프를 트랙 영역으로 드래그하거나, 오디오 파일을 추가할 때 녹음, 루프 또는 오디오 파일 콘텐츠를 포함하는 리전이 생성됩니다. 리전은 트랙 영역에서 모서리가 둥근 직사각형으로 나타나며 리전 유형에 따라 서로 다른 기본 색상을 사용합니다.  
출처: [https://support.apple.com/ko-kr/guide/logicpro-ipad/lpip1093bde1/ipados#](https://support.apple.com/ko-kr/guide/logicpro-ipad/lpip1093bde1/ipados#)

리전(Region)이란, 오디오의 시작점과 길이를 블록 형태로 나타낸 구성요소를 뜻한다. 리전의 핵심 속성(property)는 시작점(start)과 길이(length)이다. 타임라인의 어디에서 시작해서 길이는 얼만큼인지의 정보를 담고 있는 컴포넌트인 것이다. 이것은 소리와 관계없는 순수한 시간 좌표이다. 즉, 리전은 타임라인 위의 위치와 길이 정보 블럭 이라는 도구로 사용이 가능한 것이다.

```ts
Region {
  id: string
  sourceId: string       ← 비어있어도 된다
  start: FrameCount      ← 타임라인 위치 (핵심)
  length: FrameCount     ← 타임라인 길이 (핵심)
  sourceStart: FrameCount
}
```

## 4. 하나의 시간축 기반으로 통합하기

## 4-1. 샘플레이트(Sample Rate)와 프레임(Frame)

그렇다면 문제는 무엇일까? drop-ai/core 의 Session 은 샘플레이트(Sample Rate)를 모든 트랙이 공유하도록 설계되어있다. 모든 미디어의 타임라인 위치를 이 샘플레이트 기준 프레임으로 통합해야한다.

샘플레이트(Sample Rate) 란, 1초 동안 오디오 신호를 몇 번 측정(샘플링)하는지를 나타내는 단위이다. 단위는 Hz를 사용하며, 일반적으로 44100Hz 또는 48000Hz가 사용된다. 44100Hz라면 1초에 44,100개의 샘플이 존재한다는 뜻이다.

프레임(Frame) 이란, 이 샘플레이트를 기준으로 한 시간의 최소 단위이다. drop-ai/core에서는 FrameCount 라는 타입으로 표현하며, 이것은 결국 샘플 단위의 정수값이다. 예를 들어 샘플레이트가 44100Hz인 세션에서 1초 뒤에 시작하는 리전의 start는 44100이 되고, 2초 길이의 리전이라면 length는 88200이 된다.

```text
sampleRate = 44100
1초 = 44100 frames
2.5초 = 110250 frames

Region.start  = 44100   → 1초 지점에서 시작
Region.length = 88200   → 2초 동안 지속
```

즉 프레임은 "초(second)"를 정수로 다루기 위한 장치이다. 부동소수점 연산 없이 정확한 시간 계산이 가능하고, 오디오 샘플과 1:1로 대응되기 때문에 오디오 재생과의 동기화가 자연스럽다.

여기서 핵심은, 이 프레임이라는 단위 자체는 소리와 무관한 순수한 시간 좌표라는 점이다. 샘플레이트가 세션 전체의 "시간 해상도"를 결정하는 것이지, 반드시 오디오가 있어야만 쓸 수 있는 단위가 아니다. 이미지든 텍스트든, 같은 샘플레이트 기준의 프레임으로 start와 length를 표현하면 하나의 시간축 위에서 모든 미디어를 동기화할 수 있게 된다.

## 4-2. 단일 샘플레이트(Sample Rate) 기반의 프레임 좌표계

핵심은 하나의 샘플레이트(기본 44100)를 모든 트랙이 공유하도록 설계된 drop-ai/core의 Session에 맞춰, 모든 미디어의 타임라인 위치를 이 샘플레이트 기준 프레임으로 표현하는 것이다.

```text
Session.sampleRate = 44100

오디오 3초짜리:   Region { start: 0,      length: 132300 }  (44100 × 3)
비디오 10초짜리:  Region { start: 0,      length: 441000 }  (44100 × 10)
이미지 5초짜리:   Region { start: 132300, length: 220500 }  (44100 × 5, 3초 지점에서 시작)
텍스트 2초짜리:   Region { start: 0,      length: 88200  }  (44100 × 2)
```

UI에서는 framesToSeconds(frames, sampleRate)로 변환하여 초 단위로 보여주고, 사용자 조작 시 secondsToFrames(seconds, sampleRate)로 다시 프레임으로 변환한다.

```text
사용자가 타임라인에서 3.0초 지점을 클릭
→ secondsToFrames(3.0, 44100) = 132300
→ Region { start: 132300, ... } 으로 저장

Region에서 UI로 표시할 때
→ framesToSeconds(132300, 44100) = 3.0
→ 사용자에게 "3.0초" 로 표시
```

이 단일 좌표계 위에서 오디오 Region이든 이미지 Region이든, "132300 프레임에서 시작"이면 같은 시간(3초)에 시작한다. 좌표계가 하나이므로 동기화가 보장된다.

## 5. 프레임(frame) 좌표계를 이용한 멀티미디어의 시간 동기화

Region 위치는 샘플레이트와 프레임 변환으로 하나의 타임라인에 표시하는것에 성공하였다. 그렇다면 재생 시 각 미디어의 출력은 어떻게 설정할까? 재생 버튼을 누르면 오디오는 소리를 내야하고, 비디오는 영상을 보여줘야하고, 이미지는 화면에 나타나야 하고, 텍스트는 글씨를 그려야한다. 재생이 시작되면, rAF(requestAnimationFrame) 루프가 engine.getCurrentTime()을 매 프레임 읽어서 store.currentTime에 쓴다. 이 하나의 시간값이 모든 미디어의 출력 기준이 된다.

```text
engine.getCurrentTime()
→ store.setCurrentTime(t)
→ 오디오: WebAudioProvider가 예약된 시간에 자동 재생 (AudioBufferSourceNode) → 스피커
→ 비디오: videoElement.currentTime = t (muted, 영상 프레임만) → 프리뷰
→ 이미지: Region.start ≤ t ≤ Region.end ? → drawImage → 프리뷰
→ 텍스트: Region.start ≤ t ≤ Region.end ? → fillText → 프리뷰
```

하나씩 뜯어보자. engine.getCurrentTime() - 오디오 엔진에서 현재 재생 시간 t를 가져온다. 이것이 모든 동기화의 출발점이다.

store.setCurrentTime(t) - 그 시간을 Zustand store에 저장한다. 이렇게 하면 React 컴포넌트들이 이 값을 구독해서 참조할 수 있게 된다.

오디오는 특별하다. rAF 루프에서 매 프레임 t를 확인하는 방식이 아니다. 재생 시작 시 AudioBufferSourceNode.start(when)으로 모든 Region의 재생 시점을 미리 스케줄링 해둔다. 이후에는 Web Audio API가 알아서 정확한 타이밍에 소리를 낸다. 능동적 스케줄링이라고 부르는 이유다.

비디오는 숨겨진 `<video>` 엘리먼트의 currentTime을 t에 강제로 맞춘다. muted로 재생하는 이유는, 소리는 비디오 임포트 시 추출한 오디오 트랙을 WebAudioProvider가 따로 처리하기 때문이다. `<video>`는 영상 프레임(화면)만 보여주면 된다. 프리뷰 Canvas가 ctx.drawImage(videoElement)로 현재 프레임을 그린다.

이미지는 현재 시간 t가 Region 범위 안(Region.start ≤ t ≤ Region.start + Region.length)이면 Canvas에 drawImage()로 그리고, 범위 밖이면 안 그린다. 그게 전부다.

텍스트도 이미지와 동일한 로직이다. 범위 안이면 fillText()로 Canvas에 렌더링하고, 밖이면 숨긴다.

핵심은, 모든 미디어가 동일한 t 하나에 반응한다는 것이다. 차이는 "그 시간에 뭘 출력하느냐"뿐이다. 소리가 아닌 미디어들은 시간정보에 따라 visible 여부를 설정해주었다. 하지만 이 단순함을 얻기 위해서는 앞서 설명한 두 가지 결정이 전제되어야 했다. Region이 시간 좌표의 범용 도구라는 것, 그리고 engine.getCurrentTime()이 단일 시간 원천이라는 것. 이 두 결정이 없었다면 이미지의 "3초에서 시작"과 오디오의 "3초에서 시작"이 같은 의미인지 보장할 수 없었을 것이다.

(+ 덧붙여, 이부분에 사용된 개념이 어댑터 패턴(Adapter Pattern)이라는 것을 후에 알게되었다. 사용하고 보니 어댑터 패턴이 적용된 부분이 많은데, 이부분에 대해서 추후 다시 다루도록 하겠다.)

## 6. 전체 미디어 동기화 흐름

모든 임포트는 CommandExecutor.history.execute()를 통과한다. 이것은 등록 과정 전체를 하나의 Undo/Redo 단위로 묶는다. 비디오 임포트를 취소하면, 비디오 트랙, 오디오 트랙, RegionGroup, TrackGroup, 프리뷰 레이어, 미디어 파일 엔트리가 모두 한 번에 제거된다.

결국 멀티미디어 동기화의 핵심은 세 가지였다. 하나의 좌표계, 하나의 시간 원천, 동일한 구조 위에서 출력만 분기. Region이라는 공통 구조 위에서 "무엇을 출력하느냐"만 미디어 타입에 따라 달라지게 하면, 어떤 미디어를 추가하더라도 기존 동기화 메커니즘이 그대로 작동한다.

처음에 이미지와 텍스트를 타임라인에 올려야 한다는 요구사항을 받았을 때, 별도의 타임라인 시스템을 만들어야 하나 고민했다. 하지만 Region의 start와 length는 이미 소리와 무관한 순수한 시간 좌표였다. 기존 설계를 억지로 확장한 게 아니라, 이미 확장 가능한 구조였다는 걸 나중에 깨달은 셈이다. 이 문제를 해결하면서 추상화의 중요성에 대해 다시한번 깨닫게 되었다.

> 좋은 추상화는 처음 의도하지 않았던 문제까지 풀어준다

## 참조

- 타임라인 정의: [https://www.adobe.com/kr/creativecloud/video/discover/video-timeline.html](https://www.adobe.com/kr/creativecloud/video/discover/video-timeline.html)
- Logic Pro 리전 설명: [https://support.apple.com/ko-kr/guide/logicpro-ipad/lpip1093bde1/ipados](https://support.apple.com/ko-kr/guide/logicpro-ipad/lpip1093bde1/ipados)
- Web Audio API: [https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- AudioBuffer: [https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
- AudioBufferSourceNode: [https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)
- AudioBufferSourceNode.start(): [https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)
- requestAnimationFrame: [https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- CanvasRenderingContext2D.drawImage(): [https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)
- 어댑터 패턴: [https://inpa.tistory.com/entry/GOF-%F0%9F%92%A0-%EC%96%B4%EB%8C%91%ED%84%B0Adaptor-%ED%8C%A8%ED%84%B4-%EC%A0%9C%EB%8C%80%EB%A1%9C-%EB%B0%B0%EC%9B%8C%EB%B3%B4%EC%9E%90](https://inpa.tistory.com/entry/GOF-%F0%9F%92%A0-%EC%96%B4%EB%8C%91%ED%84%B0Adaptor-%ED%8C%A8%ED%84%B4-%EC%A0%9C%EB%8C%80%EB%A1%9C-%EB%B0%B0%EC%9B%8C%EB%B3%B4%EC%9E%90)

관련 글: [Part 1] 웹브라우저 멀티에디터 만들기 - 아키텍처 설계  
[https://insight74278.tistory.com/19](https://insight74278.tistory.com/19)
