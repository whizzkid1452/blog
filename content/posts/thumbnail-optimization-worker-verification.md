---
title: '[Part 3.] Web Worker를 다시 의심하고 검증하기'
description: '썸네일 생성 경로의 전체 처리 시간과 UI 루프 지연을 분리해 Web Worker의 역할을 다시 검증합니다.'
date: '2026-06-09'
publishedAt: '2026-06-09T11:23:22+09:00'
tags: ['performance', 'thumbnail', 'web-worker', 'webcodecs']
series:
  name: '썸네일 생성 최적화'
  order: 3
draft: false
featured: true
---

썸네일 생성 최적화 시리즈의 마지막 글이다. 앞선 과정은 다음 글에서 볼 수 있다.

- [[Part 1.] Web Worker를 이용한 썸네일 생성 최적화](/posts/thumbnail-optimization-web-worker)
- [[Part 2.] 썸네일 생성 구조 재설계하기](/posts/thumbnail-optimization-structure-redesign)

## [sort1] 1. Web Worker를 다시 의심한 이유

1편에서는 썸네일 생성 비용을 메인 스레드에서 분리하기 위해 Web Worker를 도입했다. 2편에서는 썸네일을 하나의 작업으로 보지 않고 다음 세 가지로 나눴다.

- 업로드 직후 보여줄 poster
- 현재 viewport에 필요한 visible tile
- 화면 밖 구간을 미리 만드는 background thumbnail prefetch

구조를 나누고 나니 다른 질문이 생겼다.

> 직접 사용했을 때 불편하지 않다면 Web Worker를 제거해도 되지 않을까?

이 질문에 답하려면 전체 생성 시간만 비교해서는 부족했다. Web Worker를 유지할 근거가 처리량인지, 메인 스레드 응답성인지 구분해야 했다.

## [sort1] 2. 직접 사용한 느낌으로 판단할 수 있는 범위

직접 사용해 보는 것은 제품 판단에 필요하다. import 직후 스크롤과 드래그가 자연스럽다면 당장 추가 최적화가 필요하지 않다고 판단할 수 있다. 그러나 수동 검증만으로 성능 문제가 없거나 Web Worker를 제거해도 안전하다고 결론 내릴 수는 없다.

| 판단                                     | 수동 검증만으로 가능한가 |
| ---------------------------------------- | ------------------------ |
| 현재 사용 흐름이 불편한지 확인           | 가능                     |
| 추가 스케줄링의 우선순위 결정            | 가능                     |
| 성능 문제가 모든 환경에서 없다고 단정    | 불가능                   |
| Web Worker 제거 후 회귀가 없다고 단정    | 불가능                   |
| 대용량·고해상도 영상에서도 안전한지 판단 | 불가능                   |

이번 검증에서 확인할 질문은 다음과 같이 좁혔다.

> 썸네일 생성 중 메인 스레드의 UI 루프가 얼마나 지연되는가?

## [sort1] 3. “빠르다”를 세 가지로 나누기

썸네일 생성 경로가 빠르다는 표현에는 서로 다른 세 가지 의미가 섞일 수 있다.

| 기준             | 확인하려는 것                                      |
| ---------------- | -------------------------------------------------- |
| 첫 시각적 피드백 | import 후 첫 이미지가 보이는 데 걸린 시간          |
| 전체 생성 시간   | 요청한 썸네일이 모두 준비되는 데 걸린 시간         |
| UI 루프 지연     | 생성 중 `requestAnimationFrame` 간격이 밀리는 정도 |

poster-first 구조는 첫 시각적 피드백을 줄이기 위한 선택이다. 1편의 측정에서는 첫 region 표시가 `6262.2ms`에서 `2815.8ms`로 약 55% 단축됐다. 이 값은 전체 썸네일을 기다리지 않고 poster를 먼저 보여준 결과다. Web Worker 자체의 효과로 해석하면 안 된다.

Web Worker의 역할은 전체 생성 시간과 UI 루프 지연을 함께 비교해야 판단할 수 있다.

## [sort1] 4. WebCodecs 실행 위치를 분리한 벤치마크

초기 비교는 `HTMLVideoElement seek`와 `Worker/WebCodecs`만 대상으로 삼았다. 이 비교만으로는 WebCodecs가 빨랐는지, Web Worker로 실행 위치를 옮긴 효과인지 구분할 수 없다. 그래서 `Main/WebCodecs`를 추가해 세 경로를 비교했다.

| 경로                    | 처리 방식                                                    |
| ----------------------- | ------------------------------------------------------------ |
| `HTMLVideoElement seek` | `currentTime` 변경 후 브라우저 비디오 디코더에서 프레임 캡처 |
| `Main/WebCodecs`        | 메인 스레드에서 `mp4box` demux와 `VideoDecoder` decode 실행  |
| `Worker/WebCodecs`      | Web Worker에서 `mp4box` demux와 `VideoDecoder` decode 실행   |

`Main/WebCodecs`와 `Worker/WebCodecs`는 같은 파일을 `ArrayBuffer`로 읽고, 선택한 sample을 디코딩하는 흐름으로 맞췄다. 두 경로의 주요 차이는 demux와 decode를 실행하는 스레드다.

같은 비디오 파일에서 각 경로로 1장, 10장, 100장을 요청했다. 이 화면만으로는 반복 횟수와 결과 분산을 확인할 수 없으므로, 아래 수치를 다른 환경의 일반적인 성능으로 확대 해석하지 않는다.

## [sort1] 5. UI 루프 지연을 본 두 지표

`Main busy`는 측정 중 `requestAnimationFrame` 간격이 60fps의 프레임 예산인 `16.7ms`를 초과한 정도를 비율로 나타낸 대리 지표다. 순수 JavaScript 실행 시간만 측정하지는 않는다. 렌더링, 가비지 컬렉션, `ImageBitmap` 수신과 브라우저 내부 작업도 포함될 수 있다.

`Max stall`은 측정 구간에서 관찰된 가장 긴 단일 프레임 간격이다.

따라서 두 값은 실제 입력 지연을 직접 측정한 결과가 아니다. 값이 클수록 UI 루프가 길게 밀렸을 가능성과 일치하지만, 실제 에디터의 스크롤과 드래그가 느려졌다는 결론에는 별도의 상호작용 측정이 필요하다.

## [sort1] 6. 1장·10장·100장 측정 결과

![HTMLVideoElement seek, Main/WebCodecs, Worker/WebCodecs 썸네일 생성 벤치마크](/images/thumbnail-optimization-worker-verification/thumbnail-generation-benchmark.png)

_같은 비디오 파일에서 세 경로로 1장, 10장, 100장을 요청한 측정 화면_

### [sort2] 6-1. poster 1장은 HTMLVideoElement seek가 빨랐다

| 경로                    | 첫 프레임   | 전체 시간   |
| ----------------------- | ----------- | ----------- |
| `HTMLVideoElement seek` | `50.29ms`   | `51.2ms`    |
| `Worker/WebCodecs`      | `3163.29ms` | `3163.35ms` |
| `Main/WebCodecs`        | `6143.84ms` | `6143.85ms` |

이 실행에서는 `HTMLVideoElement seek`가 poster 1장을 가장 빨리 만들었다. WebCodecs 두 경로는 파일 읽기, demux, decoder 준비 비용을 한 장에 모두 부담했다. 이 결과는 업로드 직후 poster를 seek로 만드는 선택을 뒷받침한다.

### [sort2] 6-2. 10장 seek 결과는 이상치로 분리했다

10장 실행에서 `HTMLVideoElement seek`의 전체 시간은 `912348.63ms`, `Max stall`은 `909557ms`였다. 다른 실행과 차이가 지나치게 크다. 현재 자료만으로는 seek queue 정지, 디코더 지연, 백그라운드 탭 제한, 측정 오류 중 무엇이 관여했는지 구분할 수 없다.

따라서 이 값으로 “여러 장의 seek는 항상 느리다”라고 결론 내리지 않았다. 같은 조건의 반복 실행과 Performance trace가 필요하다. 2편에서 제안한 “visible tile은 main-thread seek queue로 생성한다”는 설계도 이 결과만으로는 검증되지 않았다.

### [sort2] 6-3. 100장에서는 전체 시간보다 UI 루프 지표가 달랐다

| 경로                    | 전체 시간    | 장당 평균  | Main busy | Max stall   |
| ----------------------- | ------------ | ---------- | --------- | ----------- |
| `Worker/WebCodecs`      | `3936.61ms`  | `39.37ms`  | `11%`     | `428.87ms`  |
| `Main/WebCodecs`        | `4047.95ms`  | `40.48ms`  | `66%`     | `1251.81ms` |
| `HTMLVideoElement seek` | `20844.48ms` | `208.44ms` | `0%`      | `21.05ms`   |

`Worker/WebCodecs`와 `Main/WebCodecs`의 전체 시간 차이는 `111.34ms`, 약 2.8%였다. 이 실행만 보면 Web Worker가 전체 처리를 크게 단축했다고 말하기 어렵다.

반면 `Main busy`는 `66%`에서 `11%`로 55%포인트 낮았고, `Max stall`은 `1251.81ms`에서 `428.87ms`로 약 65.7% 낮았다. 이 차이는 demux와 decode를 Web Worker로 옮겼을 때 UI 루프 지연이 줄어든다는 해석과 일치한다.

`HTMLVideoElement seek`의 `Main busy`와 `Max stall`은 낮았지만 전체 생성에는 `20844.48ms`가 걸렸다. 이 경로는 브라우저 비디오 디코더의 비동기 seek를 기다리므로, rAF 기반 지표가 낮다는 사실만으로 처리량까지 좋다고 판단할 수 없다.

## [sort1] 7. 2편의 구조에서 수정한 판단

[2편의 구조](/posts/thumbnail-optimization-structure-redesign)는 “지금 보는 것은 우선 처리하고, 나중에 볼 수도 있는 것은 보조 작업으로 처리한다”는 기준을 세웠다. 이번 측정도 작업의 우선순위를 나눈다는 방향은 바꾸지 않았다. 다만 실행 경로에 대한 확신은 다음과 같이 좁혔다.

| 작업                          | 현재 판단                                                        |
| ----------------------------- | ---------------------------------------------------------------- |
| poster 1장                    | `HTMLVideoElement seek` 사용 근거가 있음                         |
| visible tile                  | seek와 Worker 중 어느 경로가 나은지 아직 단정하지 않음           |
| background thumbnail prefetch | 대량 처리 시 `Worker/WebCodecs`를 유지할 근거가 있음             |
| `Main/WebCodecs` 단독 전환    | 이번 실행에서는 UI 루프 지연 지표가 커 기본 경로로 선택하지 않음 |

즉, 이번 벤치마크는 2편의 구조 전체를 증명하지 않는다. poster와 background thumbnail prefetch를 분리한 방향을 지지하지만, visible tile 경로는 실제 에디터에서 다시 비교해야 한다.

## [sort1] 8. 실제 에디터에서 추가로 확인할 것

벤치마크 페이지는 디코딩 경로를 통제해 비교하기 좋다. 하지만 실제 에디터에서는 drag-and-drop 처리, 배치 계산, preview 상태 갱신, Canvas redraw, command commit이 함께 실행된다.

실제 UI에 대한 결론을 내려면 같은 시나리오를 세 전략으로 반복해야 한다.

| 비교군                   | 확인 목적                           |
| ------------------------ | ----------------------------------- |
| `Worker/WebCodecs`       | 현재 구조의 상호작용 지연 측정      |
| `Main/WebCodecs`         | Web Worker 제거 시 변화 측정        |
| thumbnail generation off | 썸네일 생성 외 타임라인 비용 기준선 |

측정 시나리오는 import 직후 region drag, 썸네일 생성 완료 후 drag, zoom 단계별 drag, clip 수 증가, trim handle drag로 나눈다. 이 비교가 있어야 썸네일 생성과 타임라인 redraw의 영향을 구분할 수 있다.

## [sort1] 9. Web Worker를 유지해도 필요한 메모리 관리

2편에서 사용한 `backfill`은 “빈 곳을 나중에 채운다”는 뜻이 강하다. 실제 작업은 사용자가 아직 보지 않은 구간을 낮은 우선순위로 미리 생성하므로, 이 글에서는 `background thumbnail prefetch`로 부른다.

Web Worker는 메인 스레드 점유를 줄일 수 있지만 결과 `ImageBitmap`과 캐시 메모리까지 줄여주지는 않는다. 다음 방어선은 별도로 필요하다.

- `ImageBitmap`을 작은 batch로 전송한다.
- 캐시에 저장할 썸네일 수의 상한을 둔다.
- 같은 timestamp의 in-flight 요청을 중복 실행하지 않는다.
- scroll과 zoom 이후 도착한 stale 결과를 버린다.
- 사용하지 않는 `ImageBitmap`에 `close()`를 호출한다.
- import 취소, undo, 프로젝트 전환 시 진행 중인 작업을 중단한다.

## [sort1] 10. 현재 선택

현재 측정 근거로는 다음 구조를 유지한다.

| 선택                            | 근거                                             | 남는 비용                    |
| ------------------------------- | ------------------------------------------------ | ---------------------------- |
| poster-first 유지               | 1장 seek가 `51.2ms`에 완료됨                     | poster와 thumbnail 캐시 분리 |
| `Worker/WebCodecs` 유지         | 100장에서 Main busy와 Max stall이 더 낮게 관찰됨 | message, abort, 메모리 관리  |
| visible tile 경로는 보류        | 10장 seek 이상치의 원인을 확인하지 못함          | seek/Worker 비교 측정 필요   |
| background prefetch에 상한 적용 | 화면 밖 썸네일은 즉시 완료할 필요가 없음         | 우선순위와 캐시 정책 필요    |

따라서 현재 결론은 “Web Worker가 더 빠르다”가 아니다.

> 이번 측정에서는 Web Worker를 제거할 근거가 부족했다. Worker/WebCodecs는 Main/WebCodecs와 전체 시간이 비슷했지만, UI 루프 지연 대리 지표는 더 낮았다.

## [sort1] 11. 아직 결론 내리지 않은 것

| 남은 질문                            | 필요한 근거                                     |
| ------------------------------------ | ----------------------------------------------- |
| 10장 seek 이상치의 원인은 무엇인가   | 반복 실행, timeout 로그, Performance trace      |
| 실제 drag 입력 지연도 줄어드는가     | 전략별 E2E 측정                                 |
| 다른 환경에서도 같은 경향이 나오는가 | 저사양 PC, 긴 영상, 4K 영상의 반복 측정         |
| 메모리 누수가 없는가                 | 반복 import, undo, 프로젝트 전환 후 메모리 추적 |
| 캐시 상한이 적절한가                 | 영상 길이와 viewport 이동 패턴별 관찰           |

한 번의 벤치마크 화면만으로 Web Worker가 모든 환경에서 유리하다고 단정할 수 없다. 지금 확인한 것은 이 파일과 실행 환경에서 나타난 경향이다.

## [sort1] 12. 마치며

처음에는 Web Worker를 쓰면 썸네일 생성이 빨라질 것이라고 생각했다. 이번 측정에서 100장 전체 생성 시간은 `Worker/WebCodecs`와 `Main/WebCodecs`가 비슷했다. 대신 Main busy와 Max stall에서 차이가 나타났다.

이 결과로 Web Worker의 역할을 “처리 시간 단축”에서 “대량 디코딩 중 UI 루프 지연 위험 감소”로 더 좁게 정의할 수 있었다. poster는 seek로 먼저 보여주고, 화면 밖 대량 생성은 Web Worker에 맡긴다. visible tile 경로는 실제 상호작용 측정 전까지 단정하지 않는다.

> 성능 최적화는 가장 빠른 경로 하나를 고르는 일이 아니라, 사용자가 먼저 보는 작업과 나중에 처리할 작업에 서로 다른 기준을 적용하는 일이다.

이전 글:

- [[Part 1.] Web Worker를 이용한 썸네일 생성 최적화](/posts/thumbnail-optimization-web-worker)
- [[Part 2.] 썸네일 생성 구조 재설계하기](/posts/thumbnail-optimization-structure-redesign)
