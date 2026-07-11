---
title: '타임라인 Region 만들기 - Canvas 단일 레이어의 한계와 SVG 분리'
description: '타임라인 줌에서 Canvas 크기 한계로 리전이 사라지는 문제를 SVG 레이어 분리로 해결한 과정을 정리합니다.'
date: '2026-04-15'
publishedAt: '2026-04-15T18:04:30+09:00'
tags: ['timeline', 'canvas', 'svg', 'editor']
draft: false
---

## 1. 들어가며

타임라인을 만들면서 예상치 못 한 버그가 발생했던 이야기를 공유하려고 한다. 줌 레벨을 올리면 리전이 통째로 사라지는 버그. 특정 줌 이상에서는 캔버스 자체가 아예 렌더되지 않는다. 처음엔 렌더링 로직 어딘가에 조건이 잘못 들어간 줄 알았다. 하지만 원인은 canvas 에 있었다.

리전(Region)이란, 특정 미디어 소스(오디오, 비디오, 이미지 등)의 전체 구간 중 편집 타임라인 상에 배치되어 실제 재생 및 편집 대상이 되는 특정 시간 구간(클립)을 의미한다.

브라우저의 `<canvas>` 요소에는 상한값이 존재한다. Chrome 기준 최대 약 16,384px로, 타임라인 전체 너비를 `duration * effectivePxPerSec`으로 계산해서 캔버스로 그리고 있는데, 이 값이 한계를 넘어서는 순간 캔버스가 생성 자체에 실패하거나 빈 화면을 반환하게 된 것이었다.

```ts
canvas.width = totalTimelineWidth * dpr;
// → 줌 시 totalTimelineWidth > 16,384 초과
// → 캔버스 생성 실패 → 파형도, 리전도 전부 사라짐
```

파형과 리전을 단일 캔버스에 함께 그리는 구조였기 때문에, 캔버스가 깨지면 리전도 같이 사라졌다. 근본 원인은 구조 자체에 있었다.

## 2. 첫 번째 시도 - 캔버스 가상 스크롤

가설은 단순했다. 캔버스 물리 크기를 뷰포트 + 버퍼 영역으로 제한하고, 스크롤 시 위치만 이동하면 크기 상한을 피할 수 있다.

```ts
renderStartPx = max(0, scrollLeft - BUFFER_PX);
renderEndPx = scrollLeft + viewportWidth + BUFFER_PX;
renderWidth = renderEndPx - renderStartPx;
```

캔버스 width를 `renderWidth * dpr`로 고정하고, `style.left = renderStartPx`로 위치를 옮기면서 스크롤마다 보이는 구간만 다시 그린다. 코드를 짜보니 개념은 깔끔했다. 하지만 막상 실행해보니 문제가 세 가지 터졌다.

- 타이밍 어긋남: `scrollLeft`와 캔버스 재그리기 타이밍이 1프레임 어긋나면 리전이 깜빡이거나 위치가 틀어졌다. `scrollLeft`를 읽고 → 캔버스 위치를 옮기고 → 새 구간을 그리는 세 단계가 한 프레임 안에 처리되지 않으면, 브라우저가 중간 상태를 화면에 나타낸다.
- 경계 계산 오차: `renderStartPx` / `renderWidth` 경계 계산에 조금만 오차가 생겨도 타임라인 끝 리전이 잘렸다. 버퍼를 얼마나 잡아야 하는지 명확한 기준도 없었다.
- 클릭 테스트 좌표 오류: 사용자가 리전을 클릭하면 `offsetLeft`를 기반으로 캔버스 로컬 좌표를 계산했는데, 가상 스크롤로 `offsetLeft`가 `renderStartPx`에 따라 계속 바뀌다 보니 클릭 위치가 스크롤 위치에 비례해서 어긋났다.

결국 캔버스 크기 문제는 해결했지만 `scrollLeft` · `offsetLeft` · 재그리기 타이밍이 한 묶음으로 강결합되면서, 정합 포인트가 너무 많아졌다.

## 3. 파형과 리전은 성격 자체가 다르다

여기서 한 발 물러서서 생각했다. 왜 이렇게 정합 포인트가 많을까?

파형은 수만 개의 샘플을 래스터로 그린다. 줌과 스크롤에 따라 화면 밀도가 계속 바뀌는 동적 데이터다. 프레임마다 재계산/재렌더가 필요하고, 캔버스 가상 스크롤이 이 경우엔 적합하다.

리전은 다르다. 사각형, 라벨, 핸들. 소수의 벡터 그래픽스(vector graphics)요소들이다. 이걸 캔버스에 직접 그리고 있으니, 스크롤할 때마다 위치를 수동으로 계산해야 하고, 클릭 이벤트도 좌표 변환을 거쳐야 한다.

벡터 그래픽스(vector graphics)는 점, 선, 곡선, 다각형과 같은 직교 좌표계에 정의된 기하학적 기본 요소(영어판)로부터 시각적 이미지를 직접 생성하는 컴퓨터 그래픽스의 한 형태다. 출처: https://ko.wikipedia.org/wiki/%EB%B2%A1%ED%84%B0_%EA%B7%B8%EB%9E%98%ED%94%BD%EC%8A%A4

리전을 DOM/SVG로 분리하면 브라우저가 보이는 구간만 렌더링해 보여주기 때문에, 별도의 가시 영역 처리 로직이 줄어든다. `scrollLeft` 정합 문제가 애초에 생기지 않는다. 렌더링 특성에 맞는 기술을 분리하는 것이 중요했다.

```text
파형/썸네일/프리뷰  →  Canvas (래스터, 고빈도 재렌더)
리전/핸들/라벨     →  SVG/DOM (벡터 UI, 상호작용)
```

### 3-1. 왜 순수 DOM이 아니라 SVG인가?

이 작업의 핵심 선택은 사실 여기였다. 리전은 시간축 좌표(x, width)를 기준으로 배치되는 사각형+핸들+라벨 묶음인데, 이 구조는 SVG의 rect/text 모델과 거의 1:1로 대응된다. 즉, 도메인 모델을 화면 요소로 옮길 때 중간 번역 계층이 적다. 좌표를 바로 넣으면 그려지고, 확대/축소가 바뀌어도 같은 좌표계에서 해석이 일관된다.

순수 DOM(div)으로도 구현은 가능하다. 하지만 리전 수가 늘어나면 left/width 절대 배치를 계속 갱신해야 하고, 몸체·라벨·선택 테두리·핸들을 여러 요소와 스타일로 분리 관리해야 한다. 클릭 영역을 넓히기 위한 투명 상호작용 레이어까지 얹기 시작하면 구조가 금방 복잡해진다. 반면 SVG는 같은 좌표계 안에서 사각형, 텍스트, 핸들을 한 묶음으로 다루기 쉬워서 코드의 의도와 렌더 결과가 더 직접적으로 연결된다.

실무적으로도 이점이 있었다. 루트 SVG는 이벤트를 통과시키고(`pointer-events: none`), 리전과 핸들만 이벤트를 받게(`pointer-events: auto`) 설계할 수 있어 빈 영역 클릭 시 시크 동작을 유지하기 쉬웠다. 즉, SVG는 벡터 표현뿐 아니라 상호작용 경계 설계에도 유리했다.

### 3-2. 왜 파형은 PNG/SVG가 아니라 Canvas인가

파형은 리전과 성격이 다르다. 파형은 줌(px/sec)과 스크롤에 따라 화면 밀도가 계속 바뀌는 동적 래스터 데이터(Raster data) 다. 이걸 PNG로 고정하면 확대 시 블러가 생기고, 품질을 지키려면 다중 해상도 타일 생성/교체 로직이 필요해진다. SVG로 그리면 이론상 확대 품질은 좋지만, 긴 타임라인에서 샘플 기반 경로를 대량으로 유지·갱신할 때 DOM/SVG 노드 관리 비용이 커진다.

래스터 그래픽스(Raster Graphics): 컴퓨터 그래픽 과 디지털 사진 에서 래스터 그래픽, 래스터 이미지 또는 간단히 래스터는 픽셀 이라고 하는 작고 색상이 있는 직사각형 격자로 구성된 디지털 이미지 입니다. 모양과 선을 설명하기 위해 수학적 공식을 사용하는 벡터 그래픽 과 달리 래스터 이미지는 각 픽셀의 정확한 색상을 저장하므로 복잡한 색상과 세부 사항이 있는 사진 및 이미지에 이상적입니다. 출처: https://en.wikipedia.org/wiki/Raster_graphics

Canvas는 현재 뷰포트 구간을 즉시 다시 그리기에 유리하다. 특히 렌더 트리거를 `requestAnimationFrame`으로 묶으면 스크롤/리전 변경 이벤트가 연속으로 들어와도 브라우저 페인트 주기에 맞춰 한 프레임 단위로 합쳐 처리할 수 있어, 불필요한 중복 렌더와 프레임 드랍을 줄일 수 있다. 가상 스크롤과 결합하면 전체 타임라인이 아니라 보이는 구간+버퍼만 렌더링할 수 있어 파형처럼 고빈도 재렌더가 필요한 데이터에 잘 맞는다.

그래서 최종적으로 파형·썸네일은 Canvas, 리전·핸들·라벨은 SVG로 역할을 분리했다.

## 4. SVG 기반의 리전 구현하기

### 4-1. TrackRegionSvgLayer 분리

`TrackRegionSvgLayer` 컴포넌트를 새로 만들고, 캔버스에서 리전 그리기 코드를 전부 제거했다. `TrackRow` 컴포넌트에서 audio-like(오디오, 스피커 트랙)와 media-like(비디오, 이미지, 텍스트) 두 variant로 분기한다. audio-like는 solid fill + 라벨 + 선택 테두리, 눈에 보이지 않는 상호작용 영역과 리사이즈 핸들만 그린다. 썸네일과 프리뷰는 캔버스 유지했다.

```tsx
// TrackRow.tsx
const regionSvgVariant =
  track.type === 'video' || track.type === 'image' || track.type === 'text' ? 'media-like' : 'audio-like';
```

한 가지 신경 쓴 부분이 있다. 루트 `<svg>`에 `pointer-events: none`을 주고, 리전 `<rect>`와 핸들에만 `pointer-events: auto`를 설정했다. SVG 레이어가 캔버스 위를 덮고 있기 때문에 아무 설정 없이 두면 SVG가 빈 영역 클릭까지 모두 가로채게 된다. 그러면 사용자가 빈 타임라인 영역을 눌러 재생 위치를 옮기려는 동작(시크)이 아래 캔버스에 전달되지 않는다.

이를 막기 위해 루트 `<svg>`에는 `pointer-events: none`을 적용해 기본적으로 이벤트를 통과시키고, 실제로 상호작용이 필요한 리전 `<rect>`와 리사이즈 핸들에만 `pointer-events: auto`를 적용했다. 결과적으로 리전/핸들 클릭은 SVG가 처리하고, 빈 영역 클릭은 캔버스로 전달되어 기존 시크 동작이 유지된다. 타임라인 클릭이벤트 구현은 추후 따로 다루도록 하겠다.

```tsx
// TrackRegionSvgLayer.tsx
<svg
  width={totalTimelineWidth}
  height={height}
  style={{
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
    zIndex: 2,
  }}
>
  <rect x={startX} y={0} width={w} height={height} style={{ pointerEvents: 'auto', cursor: 'default' }} />
</svg>
```

### 4-2. 좌표계 통일

기존엔 좌표 변환 경로가 두 개였다. 캔버스 로컬 좌표와 타임라인 절대 좌표. `scrollLeft` 기반의 가상 스크롤이 들어가면서 캔버스 `offsetLeft`가 계속 변했기 때문에, 클릭 위치를 실제 타임라인 위치로 변환하는 계산이 복잡해졌다.

`useTrackMouseHandlers`에 `timelineContentRef`를 넘기고, 좌표기준 `timelineXFromClient`로 통일했다.

```ts
timelineXFromClient(clientX) = clientX - timelineContentRef.getBoundingClientRect().left;
```

이 방식은 “브라우저 화면 좌표(clientX)”에서 “타임라인 컨테이너의 화면상 시작점(left)”을 빼서 타임라인 내부 좌표를 직접 구한다. 즉, 캔버스가 가상 스크롤로 이동하더라도 기준점이 흔들리지 않기 때문에, 스크롤 위치와 무관하게 일관된 좌표를 얻을 수 있다.

또한 이 통일은 SVG 레이어 분리 이후 더 중요해졌다. 리전 선택/리사이즈 이벤트가 SVG와 캔버스 양쪽에서 발생하더라도 동일한 좌표 변환 함수를 사용하므로, 입력 경로가 달라도 같은 타임라인 좌표로 수렴한다.

### 4-3. 캔버스 책임 축소

`useTrackCanvasDrawing`에서 세그먼트 `fillRect` / `strokeRect`, 라벨 텍스트, `drawSegmentHandles`를 전부 제거했다. 416줄이었던 파일이 323줄로 줄었다. 캔버스는 이제 파형 렌더링, 비디오 썸네일, 이미지/텍스트 프리뷰만 담당한다.

## 5. 가상 스크롤 재적용하기

리전을 SVG 기반으로 수정한 다음, 캔버스에는 파형과 썸네일만 남았다. 그리고 1차 시도에서 실패했던 캔버스 가상 스크롤을 이번엔 파형 레이어에 다시 적용했다. 파형에 가상 스크롤을 적용하면, 스크롤·드래그마다 발생하는 drawCall 범위를 뷰포트로 제한할 수 있다. 10분짜리 타임라인 전체를 매 프레임 그리는 대신, 보이는 구간과 버퍼만 그리면 된다.

1차에서 실패한 이유는 타이밍 어긋남이 리전 클릭 이벤트를 망가뜨렸기 때문이었다. 그런데 지금은 리전이 SVG에 있다. 파형 캔버스가 1프레임 늦게 갱신되어도 리전 선택 정확도에는 영향이 없다. 정합 포인트가 없어졌으니, 1차 시도의 실패 원인이 함께 사라진 셈이다.

```ts
// useTrackCanvasDrawing.ts
const isVirtualized = viewportWidth > 0 && viewportWidth < totalTimelineWidth;
const bufferPx = isVirtualized ? viewportWidth * 0.5 : 0;

const renderStartPx = isVirtualized ? Math.max(0, scrollX - bufferPx) : 0;
const renderWidth = isVirtualized
  ? Math.min(viewportWidth + bufferPx * 2, totalTimelineWidth - renderStartPx)
  : totalTimelineWidth;

canvas.style.left = `${renderStartPx}px`;
canvas.style.width = `${renderWidth}px`;
```

SVG는 `totalTimelineWidth` 전체를 가지고 있어서 줌을 올려도 리전이 사라지지 않는다. 캔버스는 뷰포트 + 버퍼 크기로 고정되어 있어서 긴 타임라인에서도 drawCall이 일정하다. 두 문제가 동시에 해결됐다.

## 6. 결과

| 지표                  | Before               | After           |
| --------------------- | -------------------- | --------------- |
| 리전 가시성           | 줌 시 전체 미렌더    | 항상 가시       |
| 클릭 이벤트 좌표 오차 | scrollLeft 비례 증가 | 0 (스크롤 무관) |
| 캔버스 코드량         | 416줄                | 323줄 (-22%)    |
| 좌표 변환 경로        | 2개                  | 1개             |

리팩토링 전후를 간단히 확인했다. `useTrackCanvasDrawing.ts`에서 리전 `fillRect`, 핸들, 라벨 텍스트 드로우 코드를 전부 제거하니 416줄에서 323줄로 22% 줄었다. 남은 캔버스 코드는 파형 렌더링에만 집중한다. 좌표 변환 경로도 2개(캔버스 local + absolute)에서 1개(`timelineContentRef`)로 단일화됐다. 스크롤 후 리전 클릭 오차가 0이 됐고, 10분 타임라인 끝까지 스크롤해도 리전이 항상 제자리에 보였다.

## 7. 마치며

타임라인 작업은 언제나 어렵다. 그 중 top 5 안에 드는 문제 중 하나가 리전 렌더링 문제다. 역시나 예상과 같이 한번에 해결되지는 않았다. 1차 시도는 캔버스 가상 스크롤로 크기 문제를 해결했지만, 리전 좌표 정합이라는 새 문제를 만들었다. 2차 시도에서 리전을 SVG로 분리하자 두 문제가 동시에 풀렸다. 그리고 SVG 분리 덕분에 1차에서 실패했던 캔버스 가상 스크롤을 파형 레이어에 부작용 없이 적용할 수 있게 됐다.

돌이켜보면 1차 시도의 실패가 꼭 나쁜 건 아니었다. 캔버스 가상 스크롤 자체는 올바른 방향이었다. 적용할 대상이 달랐을 뿐이다. 리전과 파형의 렌더링 특성 차이를 확인하는 데 그 실패가 필요했다. 이번 작업을 하면서, 실패를 조금은 두려워하지 않게 된 것 같다.

또 하나 배운것은, 기술을 고를 때 "어떤 기술이 더 좋은가"보다 "이 데이터의 성격에 어떤 기술이 맞는가"를 먼저 묻는 것이 중요하다는 걸, 이 작업에서 다시 확인했다.

## 참조

브라우저 API

- [Canvas 크기 제한](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas)
- [SVG pointer-events](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pointer-events)
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

그래픽스 개념

- [벡터 그래픽스 (위키백과)](https://ko.wikipedia.org/wiki/%EB%B2%A1%ED%84%B0_%EA%B7%B8%EB%9E%98%ED%94%BD%EC%8A%A4)
- [래스터 그래픽스 (Wikipedia)](https://en.wikipedia.org/wiki/Raster_graphics)
- [벡터데이터와 래스터데이터](https://clouds-daily.tistory.com/116)
