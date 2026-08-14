---
title: 'rAF로 오디오 에디터 줌 기능 버벅거림 잡기'
description: '오디오 에디터 줌 핸들 드래그가 버벅이던 문제를 rAF 기반 업데이트 분리로 줄인 과정을 정리합니다.'
date: '2026-02-02'
publishedAt: '2026-02-02T18:44:37+09:00'
tags: ['performance', 'request-animation-frame', 'audio-editor', 'frontend']
draft: false
---

rAF에 대한 추가적인 정보는 이 글을 참고해주세요: [TIL | rAF란?](/posts/request-animation-frame)

## [sort1] 1. 문제 상황

오디오 에디터에 미니맵 만들어서 뷰포트 핸들 드래그하면 줌 영역 조정되게 했는데, 막상 써보니까 화면이 엄청 버벅거렸다. 핸들 드래그할 때마다 화면이 끊기는 느낌이 들어서 UX가 정말 안좋았다.

## [sort1] 2. 기존 코드의 문제

```ts
const onMove = (e2: PointerEvent) => {
  const rect = minimapRef.value!.getBoundingClientRect();
  const t = ((e2.clientX - rect.left) / rect.width) * audioDuration.value;
  const start = Math.max(0, Math.min(t, visibleEndTime.value - 0.5));
  viewportStartOverride.value = start;
  setViewportRange(start, visibleEndTime.value); // 이게 문제였음
};
```

처음엔 pointermove 이벤트 발생할 때마다 그냥 `setViewportRange`를 바로바로 호출했다. 근데 pointermove가 초당 몇십~몇백 회씩 발생하더라. 그걸 다 처리하려니까 버벅일 수밖에.

## [sort1] 3. 병목 지점

`setViewportRange` 안에서 무슨 일이 일어나는지 보면:

```ts
function setViewportRange(start: number, end: number) {
  // 1. 줌 레벨 계산
  const minPxPerSec = viewportWidth.value / (end - start);

  // 2. 파형 전체 리렌더링 (이게 진짜 무거움!)
  ws.zoom(minPxPerSec);

  // 3. 스크롤 위치 조정
  const scrollLeft = start * minPxPerSec;
  setScroll(scrollLeft, ws);
}
```

특히 `ws.zoom()`이 진짜 문제였다. 파형 전체를 다시 그리는 작업인데, DOM 조작에 Canvas 드로잉까지. 이걸 초당 100번씩 하니까 안 버벅거는게 이상하지.

이게 얼마나 많이 호출됐냐면:

```text
pointermove 이벤트 (초당 100회)
  ↓
setViewportRange 호출 (초당 100회)
  ↓
ws.zoom() + setScroll() (초당 100회)
  ↓
파형 리렌더링 (초당 100회) ❌ 당연히 버벅이지
```

## [sort1] 4. RequestAnimationFrame으로 갱신 횟수 제한하기

### [sort2] 4-1. rAF란?

`requestAnimationFrame(RAF)`는 브라우저한테 "다음 화면 그릴 때 이 함수 실행해줘"라고 부탁하는 API다.

```ts
requestAnimationFrame(() => {
  // 다음 프레임 때 (약 16ms 후) 실행됨
  console.log('다음 프레임!');
});
```

### [sort2] 4-2. rAF 특징

| 항목        | 설명                          |
| ----------- | ----------------------------- |
| 실행 시점   | 다음 리페인트 직전            |
| 주기        | 약 16ms (60fps 기준)          |
| 반환값      | 숫자 ID (나중에 취소할 때 씀) |
| 취소        | `cancelAnimationFrame(id)`    |
| 탭 비활성화 | 자동으로 멈춤 (배터리 절약됨) |

### [sort2] 4-3. 스로틀링 구현

생각해보니까 드래그할 때마다 바로바로 파형을 다시 그릴 필요가 없더라. 어차피 사람 눈엔 60fps 정도면 충분히 부드럽게 보이니까, **"프레임당 최대 1번만 호출하자"**는 전략을 세웠다.

**1단계: 변수 설정**

```ts
/** RAF ID 저장용 */
let rafId: number | null = null;

/** 가장 최신 값 저장용 */
let pendingStart: number | null = null;
let pendingEnd: number | null = null;
```

- `rafId`: 지금 RAF가 예약되어 있는지 체크하는 용도
- `pendingStart`/`pendingEnd`: 드래그하면서 계속 바뀌는 값을 임시로 저장

**2단계: 두 단계로 업데이트**

```ts
const onMove = (e2: PointerEvent) => {
  const rect = minimapRef.value!.getBoundingClientRect();
  const t = ((e2.clientX - rect.left) / rect.width) * audioDuration.value;
  const start = Math.max(0, Math.min(t, visibleEndTime.value - 0.5));

  // 1단계: UI 오버레이는 바로바로 업데이트 (반응성 유지)
  viewportStartOverride.value = start;

  // 2단계: 무거운 파형 렌더링은 RAF로 스로틀링
  pendingStart = start;
  pendingEnd = visibleEndTime.value;

  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      if (pendingStart !== null && pendingEnd !== null) {
        setViewportRange(pendingStart, pendingEnd);
        pendingStart = null;
        pendingEnd = null;
      }
      rafId = null;
    });
  }
};
```

- UI 오버레이는 즉시 업데이트: 사용자한테 "반응하고 있어요!"라고 보여줘야 하니까
- 무거운 파형 렌더링만 스로틀링: 프레임당 1번만 호출되게

### [sort2] 4-4. rAF 스로틀링의 동작 순서

```text
pointermove 1회 → pending 업데이트 → RAF 예약 (rafId에 저장)
pointermove 2회 → pending 업데이트 → rafId 있음 → RAF 새로 안 예약
pointermove 3회 → pending 업데이트 → rafId 있음 → RAF 새로 안 예약
...
다음 프레임 도착 → RAF 콜백 실행 → setViewportRange 딱 1번 호출 → rafId = null
```

핵심: 이미 RAF가 예약되어 있으면(`rafId !== null`) 새로 예약 안 하고, pending 값만 계속 갱신한다.

| 상황                             | 동작                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| 첫 pointermove                   | `rafId === null`이니까 RAF 예약                              |
| 같은 프레임의 다음 pointermove들 | `rafId !== null`이니까 RAF 예약 안 함, pending만 업데이트    |
| 다음 프레임                      | RAF 콜백 실행 → `setViewportRange` 1번 호출 → `rafId = null` |
| 그 다음 pointermove              | 다시 `rafId === null` → RAF 예약                             |

### [sort2] 4-5. 드래그 종료 시 마지막 상태 반영

```ts
const onUp = () => {
  // 마지막 업데이트 확실하게 처리
  if (rafId !== null) {
    cancelAnimationFrame(rafId); // 대기 중인 RAF 취소
    rafId = null;
  }

  if (pendingStart !== null && pendingEnd !== null) {
    setViewportRange(pendingStart, pendingEnd); // 바로 최종 업데이트
    pendingStart = null;
    pendingEnd = null;
  }

  viewportStartOverride.value = null;
  isViewportHandleDragging.value = false;
  document.body.style.cursor = '';
  detachHandleListeners(onMove, onUp);
};
```

드래그 끝나면:

- 대기 중인 RAF가 있으면 취소
- pending에 값이 남아있으면 바로 `setViewportRange` 호출

이렇게 해야 마지막 상태가 정확하게 반영됨

## [sort1] 5. 변경 전후 비교

### [sort2] 5-1. 최적화 전

```text
pointermove 이벤트 (초당 100회)
  ↓
setViewportRange 호출 (초당 100회)
  ↓
ws.zoom() + setScroll() (초당 100회)
  ↓
파형 리렌더링 (초당 100회) ❌ 버벅버벅
```

### [sort2] 5-2. 최적화 후

```text
pointermove 이벤트 (초당 100회)
  ↓
viewportStartOverride 즉시 업데이트 (초당 100회) UI 반응 빠름
  ↓
pendingStart/pendingEnd 저장 (초당 100회)
  ↓
requestAnimationFrame 예약 (최대 60회/초) 스로틀링됨
  ↓
setViewportRange 호출 (최대 60회/초)
  ↓
파형 리렌더링 (최대 60회/초) 부드럽게!
```

### [sort2] 5-3. 개선 효과

- 호출 횟수 감소: 초당 100회 → 최대 60회 (약 40% 감소)
- 반응성은 그대로: UI 오버레이는 바로바로 업데이트되니까 사용자는 느끼지 못함
- 자동 최적화: 탭 바꾸면 RAF 자동으로 멈춰서 배터리도 절약

## [sort1] 6. 핵심 정리

### [sort2] 6-1. 두 단계로 업데이트

- UI 오버레이: 즉시 업데이트로 반응성 확보
- 무거운 파형: RAF로 스로틀링해서 성능 확보

### [sort2] 6-2. 중복 호출 방지

- `rafId === null` 체크로 RAF 하나만 실행
- 불필요한 렌더링 작업 제거

### [sort2] 6-3. 최신 값 보장

- `pendingStart`/`pendingEnd`에 항상 최신 값 저장
- 드래그 끝나면 최종 값 바로 반영

## [sort1] 7. 마무리

RAF 스로틀링 진짜 간단한데 효과가 좋다. 특히:

- 브라우저랑 싱크 맞춤: 프레임 단위로 자동으로 최적화됨
- 코드 심플: `setTimeout`이나 debounce보다 깔끔
- 자동 최적화: 탭 안 보고 있으면 알아서 멈춤

오디오 에디터처럼 실시간으로 반응해야 하는 앱 만들 때 RAF 스로틀링 진짜 유용하더라.

다음에 비슷한 문제 생기면 또 써야지 ㅎㅎ

## 참고

- [Throttle](https://developer.mozilla.org/ko/docs/Glossary/Throttle)
- [Rendering performance](https://web.dev/articles/speed-rendering?hl=ko)
- [Shall the requestAnimationFrame calls always be throttled down to 60 FPS?](https://stackoverflow.com/questions/26120838/shall-the-requestanimationframe-calls-always-be-throttled-down-to-60-fps)
- [requestAnimationFrame 가이드](https://inpa.tistory.com/entry/%F0%9F%8C%90-requestAnimationFrame-%EA%B0%80%EC%9D%B4%EB%93%9C)
