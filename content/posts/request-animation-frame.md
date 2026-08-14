---
title: 'rAF란?'
description: 'requestAnimationFrame의 실행 시점, 예약 ID, 취소 방법, 프레임 단위 스로틀링 구조를 정리합니다.'
date: '2026-02-03'
publishedAt: '2026-02-03T10:06:23+09:00'
tags: ['til', 'frontend', 'performance']
draft: false
---

참고: [rAF로 오디오 에디터 줌 기능 버벅거림 잡기](/posts/audio-editor-zoom-raf-throttling)

requestAnimationFrame(RAF)은 다음 화면을 그리기 바로 전에 콜백(애니메이션 로직)을 실행하도록 브라우저에 요청하는 자바스크립트 내장 API다.

---

## [sort1] 1. requestAnimationFrame이 하는 일

브라우저가 **다음 화면을 그리기 직전**에 지정한 콜백을 실행해 줍니다.

```ts
const rafId = requestAnimationFrame(() => {
  // 다음 프레임(약 16ms 후)에 실행됨
  addTrimRegion(pendingStart, pendingEnd);
});
```

## [sort1] 2. 특징

| 항목      | 설명                        |
| --------- | --------------------------- |
| 실행 시점 | 다음 리페인트 직전          |
| 대략 주기 | 약 16ms (60fps 기준)        |
| 반환값    | 숫자 ID (취소 시 사용)      |
| 취소      | cancelAnimationFrame(rafId) |

> rAFId란?

**rafId**는 requestAnimationFrame이 반환하는 **숫자 ID**를 저장하는 변수입니다.

---

### [sort2] 2-1. requestAnimationFrame 반환값

```ts
const rafId = requestAnimationFrame(() => {
  // 다음 프레임에 실행될 코드
});
// rafId → 예: 1234 (브라우저가 부여한 숫자)
```

requestAnimationFrame은 **예약 ID**를 숫자로 반환합니다.

---

### [sort2] 2-2. rafId를 쓰는 이유: 취소

```ts
// 예약
rafId = requestAnimationFrame(() => { ... });

// 나중에 취소할 때
if (rafId !== null) {
    cancelAnimationFrame(rafId);  // 이 ID로 취소
    rafId = null;
}
```

cancelAnimationFrame(rafId)로 **아직 실행되지 않은 예약**을 취소할 수 있습니다.

## [sort1] 3. rAF 스로틀링 방식

이 코드에서는 **“한 번에 하나의 RAF만 예약”**하는 방식으로 스로틀링합니다.

---

### [sort2] 3-1. 동작 방식

```text
pointermove 1회 → pending 업데이트 → RAF 예약 (rafId 저장)
pointermove 2회 → pending 업데이트 → rafId 있음 → 새 RAF 예약 안 함
pointermove 3회 → pending 업데이트 → rafId 있음 → 새 RAF 예약 안 함
...
다음 프레임 → RAF 콜백 실행 → addTrimRegion 1회 호출 → rafId = null
```

핵심: **이미 RAF가 예약되어 있으면(rafId !== null) 새로 예약하지 않고, pending 값만 갱신**합니다.

---

### [sort2] 3-2. 코드 흐름

```ts
// onMove: pointermove마다 실행
if (rafId.current === null) {
  // ① RAF가 아직 예약 안 됐을 때만
  rafId.current = requestAnimationFrame(() => {
    // ② 다음 프레임에 실행 예약
    addTrimRegion(ps, pe); // ③ 프레임당 1회만 실행
    rafId.current = null; // ④ 다음 move에서 다시 예약 가능
  });
}
// rafId가 이미 있으면 → pending만 업데이트, RAF는 예약 안 함
```

---

### [sort2] 3-3. 스로틀링이 되는 이유

| 상황                           | 동작                                                  |
| ------------------------------ | ----------------------------------------------------- |
| 첫 번째 pointermove            | rafId === null → RAF 예약                             |
| 같은 프레임의 이후 pointermove | rafId !== null → RAF 예약 안 함, pending만 갱신       |
| 다음 프레임                    | RAF 콜백 실행 → addTrimRegion 1회 호출 → rafId = null |
| 그 다음 pointermove            | 다시 rafId === null → RAF 예약                        |

그래서 **프레임당 최대 1번만** addTrimRegion이 호출됩니다.

---

### [sort2] 3-4. pending의 역할

여러 번의 pointermove가 한 프레임 안에 들어와도:

- RAF 콜백은 **한 번만** 실행되고
- 그때 pendingStart, pendingEnd는 **가장 마지막 값**을 사용합니다.

즉, **마지막 위치만 반영**하고, **호출 횟수는 프레임당 1회로 제한**하는 구조입니다.

---

### [sort2] 3-5. 정리

| 요소                     | 역할                             |
| ------------------------ | -------------------------------- |
| rafId                    | RAF가 이미 예약됐는지 여부       |
| rafId === null           | RAF 예약 가능 → 새로 예약        |
| rafId !== null           | RAF 이미 예약됨 → pending만 갱신 |
| pendingStart, pendingEnd | RAF 실행 시점의 최신 값 저장     |

## 참고

- [Throttle](https://developer.mozilla.org/ko/docs/Glossary/Throttle)
- [Shall the requestAnimationFrame calls always be throttled down to 60 FPS?](https://stackoverflow.com/questions/26120838/shall-the-requestanimationframe-calls-always-be-throttled-down-to-60-fps)
- [Rendering performance](https://web.dev/articles/speed-rendering?hl=ko)
- [requestAnimationFrame 가이드](https://inpa.tistory.com/entry/%F0%9F%8C%90-requestAnimationFrame-%EA%B0%80%EC%9D%B4%EB%93%9C)
- [Window: requestAnimationFrame() method](https://developer.mozilla.org/ko/docs/Web/API/Window/requestAnimationFrame)
- [requestAnimationFrame 완벽 가이드](https://rhei.me/blog/cse/requestanimationframe-guide)
