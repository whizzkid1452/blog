---
title: '[드래그 최적화 시도 2] 회고록: 정말 최선이었을까?'
description: '타임라인 드래그 성능 개선 과정을 다시 검토하며 측정, 병목 분리, 재측정의 중요성을 정리합니다.'
date: '2026-06-10'
publishedAt: '2026-06-10T11:00:39+09:00'
tags: ['react', 'performance', 'canvas', 'drag']
draft: false
---

## 1. 들어가며

타임라인 리전 드래그 성능 개선 작업을 다시 돌아보면, 처음에는 문제를 너무 빨리 해결책 쪽으로 끌고 가려 했던 것 같다. 드래그가 끊기고, 캔버스가 여러 번 다시 그려지고, React 리렌더가 많이 발생한다는 사실을 보자마자 requestAnimationFrame이나 ref 패턴을 떠올리기 쉬웠다.

하지만 지금 다시 보면 더 중요한 것은 특정 패턴 자체가 아니었다. 어떤 증상이 있었고, 그 증상이 어떤 실행 경로에서 발생했는지, 그리고 각 경로를 어떤 순서로 줄여야 하는지를 나누는 과정이 더 중요했다.

이 글은 구현 내용을 다시 설명하기보다, 내가 이 문제를 어떤 순서로 풀었어야 더 좋았을지 돌아보는 회고다. 결론부터 적으면 성능 개선은 바로 패턴을 넣는 일이 아니라, 증상 관찰, 측정, 병목 분리, 작은 수정, 재측정을 반복하는 일에 가까웠다.

## 2. 당시 보였던 증상

처음 보인 증상은 타임라인에서 리전을 드래그할 때 화면이 매끄럽지 않다는 것이었다. 리전 수와 트랙 수가 늘어날수록 끊김이 더 잘 보였고, 스크롤이나 드래그 중 캔버스 렌더링이 뚝뚝 끊기는 느낌이 있었다.

이 증상만 보면 원인을 하나로 단정하기 쉽다. 예를 들어 “Canvas draw가 무겁다”거나 “React가 느리다”라고 말하고 싶어진다. 하지만 측정값을 보면 그렇게 단순하지 않았다. 이전 측정에서 확인한 값은 다음과 같았다.

| 지표                      | 변경 전 | 변경 후 | 변화 |
| ------------------------- | ------- | ------- | ---- |
| React commit 수           | 105     | 101     | -4%  |
| React actualDuration 평균 | 2.87ms  | 1.98ms  | -31% |
| canvas clearRect          | 104     | 55      | -47% |
| canvas drawImage          | 25,300  | 12,903  | -49% |
| 메인 스레드 busy time     | 1,524ms | 1,325ms | -13% |

이 표에서 직접 확인할 수 있는 사실은 Canvas draw 호출 수와 React actualDuration 평균이 줄었다는 점이다. 반대로 React commit 수는 거의 줄지 않았다. 따라서 이 작업으로 모든 병목이 사라졌다고 말할 수는 없다. 더 정확히는, 중복 Canvas redraw와 일부 React 렌더 비용은 줄였지만 React commit을 만드는 다른 경로는 남아 있었다고 보는 편이 맞다.

## 3. 처음에 헷갈렸던 부분

처음에는 드래그 중 화면이 끊기니, 화면을 그리는 모든 코드가 같은 문제를 만들고 있다고 생각하기 쉬웠다. 그러나 실제로는 서로 다른 성격의 문제가 섞여 있었다.

첫 번째는 같은 프레임 안에서 이벤트가 여러 번 발생하는 문제였다. 스크롤, 리전 변경, 드래그 중 임시 위치 변경이 짧은 시간에 반복되면서 Canvas redraw 요청도 반복됐다.

두 번째는 React가 반드시 필요하지 않은 작업에 개입하는 문제였다. Canvas redraw는 ctx.clearRect, ctx.drawImage처럼 캔버스 컨텍스트에 직접 명령을 내리는 작업이다. SVG drag visual도 실제로는 `<g>` 노드의 transform 속성 하나를 바꾸는 작업이었다.

여기서 drag visual은 프로젝트 내부에서 쓰는 표현이다. 이 글에서는 리전을 드래그하는 동안 실제 데이터가 확정되기 전, 화면에만 임시로 보여주는 이동 상태라는 뜻으로 사용한다. 예를 들어 리전을 오른쪽으로 120px 끌고 있을 때 실제 리전 시작 시간은 아직 확정하지 않고, 화면에서만 120px 이동한 것처럼 보여주는 값이다.

세 번째는 Preview 합성기의 문제였다. 이 문제는 타임라인 드래그와 같은 화면에서 관찰됐지만, 원인은 별도였다. 정지 상태에서도 매 프레임 합성 루프가 돌고 있었기 때문이다.

## 4. 먼저 했어야 할 일은 재현 조건 고정이었다

이런 문제를 풀 때 가장 먼저 했어야 할 일은 해결책을 고르는 것이 아니라 재현 조건을 고정하는 것이었다.

예를 들어 다음과 같은 시나리오가 필요했다.

```text
영상 업로드
→ 타임라인에 여러 리전 배치
→ 선택 리전을 정해진 거리와 step으로 드래그
→ 같은 시나리오를 여러 번 반복
→ 중앙값으로 비교
```

이렇게 해야 개선 전후를 같은 조건에서 비교할 수 있다. 성능 개선은 체감이 중요하지만, 체감만으로는 어떤 비용이 줄었는지 설명하기 어렵다. 특히 이 작업처럼 Canvas, SVG, React, Preview 합성기가 함께 얽혀 있으면 측정 기준이 없을 때 판단이 쉽게 흔들린다.

이 단계에서 봐야 할 값은 하나가 아니었다. React commit 수, React actualDuration, Canvas draw 호출 수, 메인 스레드 busy time을 함께 봐야 했다. FPS도 볼 수 있지만, FPS 하나만으로 병목 경로를 특정하기는 어렵다.

## 5. 병목을 실행 경로별로 나눴어야 했다

재현 조건을 고정한 뒤에는 문제를 실행 경로별로 나누는 편이 좋았다. 이 작업에서 나눌 수 있는 경로는 다음과 같았다.

| 경로               | 확인해야 할 문제                                       |
| ------------------ | ------------------------------------------------------ |
| 스크롤 이벤트      | 같은 프레임 안에서 redraw 요청이 여러 번 발생하는가    |
| regionChanged 신호 | Canvas redraw를 위해 React state 업데이트가 발생하는가 |
| drag visual        | 드래그 중 임시 위치 표시가 React 리렌더를 유발하는가   |
| Preview 합성기     | 정지 상태에서도 매 프레임 렌더링하는가                 |
| TrackContextMenu   | row 리렌더가 메뉴 서브트리까지 확산되는가              |

이렇게 나누면 각 문제의 성격이 달라진다. 스크롤 이벤트와 regionChanged 신호는 고빈도 이벤트를 프레임 단위로 묶는 문제가 된다. drag visual은 임시 시각 상태를 React 렌더 경로에 둘 필요가 있는지 판단하는 문제가 된다. Preview 합성기는 재생 중과 정지 중의 렌더링 전략을 나누는 문제가 된다. 이 분리를 하지 않고 한 번에 고치려고 하면, 수정 후에도 어떤 병목이 줄었고 어떤 병목이 남았는지 설명하기 어렵다.

## 6. 작은 수정은 rAF coalescing부터였어야 했다

가장 먼저 적용하기 좋은 수정은 requestAnimationFrame 기반 coalescing이었다. 여기서 coalescing은 같은 프레임 안에서 들어온 여러 redraw 요청을 하나의 rAF 콜백으로 합치는 것을 뜻한다. 데이터 직렬화나 전체 작업 큐의 순차 실행이 아니라, 프레임당 redraw 예약을 1회로 제한하는 스케줄링 방식이다.

```text
이벤트 N회
→ rAF 예약 1회
→ redraw 1회
```

구현은 단순하다. 이미 예약된 rAF가 있으면 새로 예약하지 않는다.

```ts
const scheduleRedraw = () => {
  if (rafRef.current) return;

  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = 0;
    draw();
  });
};
```

이 수정은 기존 구조를 크게 바꾸지 않는다. React state 경로가 남아 있어도, 같은 프레임 안에서 중복 실행되는 redraw는 줄일 수 있다. 그래서 첫 번째 수정으로 적합했다.

다만 이 수정만으로 React 리렌더가 사라지는 것은 아니다. rAF coalescing은 실행 횟수를 줄이는 장치일 뿐이다. React state 업데이트를 계속 호출한다면 React commit은 여전히 발생할 수 있다.

## 7. 그 다음 질문은 React가 꼭 필요한가였다

rAF coalescing 이후에도 React commit이 남아 있다면, 다음 질문은 이거였어야 했다.

> 이 업데이트는 꼭 React state 변경을 거쳐야 하는가?

regionChanged 신호에서 Canvas redraw만 필요하다면 React 리렌더를 거칠 필요가 없다. Canvas는 React DOM이 아니라 캔버스 컨텍스트에 직접 그리는 명령형 API이기 때문이다.

그래서 다음 단계에서는 drawTrackCanvas를 ref에 저장하고, 신호에서 최신 draw 함수를 직접 호출하는 구조가 더 적절했다.

```text
변경 전:
regionChanged
→ setRegionVersion
→ React 리렌더
→ useEffect
→ drawTrackCanvas

변경 후:
regionChanged
→ rAF guard
→ drawTrackCanvasRef.current()
→ Canvas redraw
```

이 수정은 첫 번째 수정보다 더 조심해야 한다. ref가 오래된 함수를 가리키면 최신 props나 viewport 값을 반영하지 못할 수 있다. 이 위험은 latest callback ref 패턴으로 줄일 수 있었다. 즉, drawTrackCanvas가 바뀔 때마다 drawTrackCanvasRef.current를 최신 함수로 동기화해야 했다.

## 8. drag visual은 실제 데이터와 분리해서 봤어야 했다

drag visual은 드래그 중 화면에 보여주는 임시 위치다. 실제 리전 데이터가 아니다. 사용자가 마우스를 놓기 전까지는 최종 시작 시간이나 좌표를 확정하지 않아도 된다.

이 특성을 먼저 정리했으면, drag visual을 React state 경로에 두는 것이 꼭 필요한지 더 빨리 의심할 수 있었을 것 같다.

기존 흐름은 다음에 가까웠다.

```text
drag visual 변경
→ external store notify
→ React 리렌더
→ SVG transform 반영
→ Canvas redraw
```

하지만 실제로 필요한 작업은 SVG 노드의 transform 속성을 바꾸고 Canvas를 다시 그리는 것이었다.

```text
drag visual 변경
→ subscription notify
→ rAF guard
→ SVG node.setAttribute('transform', ...)
→ Canvas redraw
→ React commit 없음
```

이것은 React를 피하려는 목적의 수정이 아니었다. React가 담당해야 할 확정 상태와, 드래그 중 임시 시각 상태를 분리한 것이다. 드래그가 끝난 뒤 실제 리전 위치를 확정할 때는 React가 개입해도 된다. 하지만 드래그 중 매 마우스 이동마다 React 렌더 사이클을 돌릴 필요는 없었다.

## 9. Preview 합성기는 별도 축으로 다뤘어야 했다

Preview 합성기는 타임라인 드래그 병목과 같은 화면에서 발견됐지만, 같은 원인이라고 보기는 어렵다. 여기서 문제는 고빈도 이벤트보다 상태별 렌더링 전략이었다.

재생 중에는 매 프레임 렌더링이 필요하다. 반대로 정지 상태에서는 화면 상태가 바뀔 때만 한 번 렌더링하면 충분하다.

따라서 정지 상태에서는 무한 rAF 루프보다 dirty flag 기반 단발 렌더링이 더 알맞았다. 여기서 dirty flag는 “다시 그릴 필요가 있음”을 표시하는 플래그다. React의 dirty checking과 같은 개념으로 사용한 것은 아니다.

```text
재생 중:
rAF loop 유지

정지 중:
상태 변경 시 dirty 표시
→ rAF에서 renderOnce 1회 실행
```

이 문제를 drag visual이나 Canvas redraw와 같은 묶음으로 처리하려 했다면 원인을 흐렸을 것이다. 관찰된 증상은 비슷해도, 해결 기준은 달랐다.

## 10. 재측정이 남은 문제를 보여 줬다

수정 후 Canvas draw 호출과 React actualDuration 평균은 줄었다. 이 부분은 측정값으로 확인할 수 있었다.

하지만 React commit 수는 105회에서 101회로만 줄었다. 이 수치만 보면 개선이 작아 보일 수 있다. 그러나 commit 수와 commit당 렌더 비용은 다른 지표다. commit 수가 거의 그대로여도 각 commit에서 수행하는 렌더 비용이 줄었다면 일부 개선은 있었다고 볼 수 있다.

동시에 이 결과는 남은 병목이 있다는 신호이기도 했다. 글에서 언급한 후보는 TrackContextMenu였다. 각 row에 메뉴가 마운트되어 있고 row 리렌더가 메뉴 서브트리까지 함께 끌고 간다면, drag visual 경로를 줄여도 React commit 수는 크게 줄지 않을 수 있다.

이 부분은 추론이다. 측정값은 React commit 수가 크게 줄지 않았다는 사실을 보여 준다. TrackContextMenu가 그 원인이라는 판단은 컴포넌트별 actualDuration과 구조 분석에 근거한 후보이지, 이 글의 수치만으로 단독 원인이라고 단정할 수는 없다.

## 11. 지금 다시 정리하는 개선 순서

다시 한다면 순서는 다음이 더 좋았을 것 같다.

1. 드래그 끊김 증상을 재현 가능한 시나리오로 고정
2. React Profiler와 Chrome Performance로 기준 수치 측정
3. Canvas redraw, React commit, SVG 갱신, Preview loop를 분리
4. rAF coalescing으로 중복 redraw 억제
5. 재측정
6. Canvas redraw를 React state 경로에서 분리
7. drag visual을 React 렌더 경로에서 분리
8. Preview 정지 상태 rAF loop 제거
9. 재측정
10. TrackContextMenu 같은 남은 병목을 별도 작업으로 분리

이 순서의 장점은 각 수정의 목적이 명확하다는 점이다. rAF coalescing은 중복 실행을 줄인다. ref 기반 draw 호출은 Canvas redraw를 React 리렌더에서 분리한다. SVG DOM 직접 조작은 드래그 중 임시 시각 상태를 React 렌더 경로에서 분리한다. dirty flag는 정지 상태의 불필요한 Preview 루프를 줄인다.

서로 비슷해 보이는 최적화라도 줄이는 비용은 다르다. 이 차이를 구분해야 수정 결과를 제대로 설명할 수 있다.

## 12. 마치며

이번 작업을 돌아보면, 가장 아쉬운 점은 해결책을 떠올리는 속도보다 문제를 나누는 속도가 늦었다는 것이다. rAF나 ref 패턴은 유용했지만, 그 패턴이 왜 필요한지 설명하려면 먼저 실행 경로를 분리해야 했다.

성능 개선은 “어떤 최적화 기법을 적용했는가”보다 “어떤 비용을 줄였는가”가 먼저다. 그리고 그 비용은 측정 없이는 분명하게 말하기 어렵다.

앞으로 비슷한 문제를 만나면 바로 패턴을 적용하기보다, 먼저 증상을 고정하고, 기준 수치를 남기고, 병목을 작은 경로로 나누는 순서로 접근하려고 한다. 그래야 개선 후에도 무엇이 줄었고 무엇이 남았는지 솔직하게 설명할 수 있다.
