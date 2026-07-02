---
title: '[썸네일 생성 최적화 시도 3] Web Worker를 다시 의심하고 검증하기'
date: '2026-07-02'
publishedAt: '2026-07-02T15:42:40+09:00'
tags: ['performance', 'thumbnail', 'web-worker', 'webcodecs']
draft: false
---

썸네일 최적화 시도 시리즈는 총 3편으로, 잘못된 판단으로 삽질을 하고, 스스로에게 질문하고 수정해나가는 과정을 담았습니다. 이전 글들은 아래 링크에서 보실 수 있습니다.

이전 글:

- [썸네일 생성 최적화 시도1] Web Worker 를 이용한 썸네일 생성 최적화: [https://insight74278.tistory.com/42](https://insight74278.tistory.com/42)
- [썸네일 생성 최적화 시도2] 썸네일 생성 구조 재설계하기: [https://insight74278.tistory.com/49](https://insight74278.tistory.com/49)

## 1. 들어가며

앞선 글에서는 비디오 썸네일 생성 구조를 두 번에 걸쳐 정리했다.

첫 번째 글에서는 Web Worker를 이용해 썸네일 생성 비용을 메인 스레드에서 분리하는 과정을 다뤘다. 그 과정에서 처음에는 Web Worker 가 항상 빠를 것이라고 생각했지만, 실제로는 생성 개수와 측정 조건에 따라 결과가 달라진다는 점을 확인했다. 그래서 seek-first-1-then-worker 전략을 선택했다.

두 번째 글에서는 썸네일 생성을 하나의 작업으로 보지 않고 poster, visible tile, background prefetch로 나누는 설계를 정리했다. 전체 duration 기준으로 미리 만드는 방식보다, 사용자가 지금 보고 있는 viewport를 먼저 채우는 방식이 더 적합하다고 판단했다.

이번 글은 그 다음 단계의 고민을 다룬다.

구조를 나누고 나니 새로운 질문이 생겼다.

이 정도 구조가 정말 필요한가?

직접 써봤을 때 불편하지 않다면 Web Worker 를 빼도 되는 것 아닌가?

Web Worker 를 유지한다면 그 이유는 속도인가, UI 응답성인가?

이번 글의 목적은 구현을 더 설명하는 것이 아니다. 이미 만든 구조를 다시 의심하고, 어떤 근거로 유지하거나 단순화할 수 있는지 판단한 과정을 정리하는 것이다.

## 2. 직접 써본 느낌만으로 충분한 경우

성능 작업을 하다 보면 숫자를 계속 보고 싶어진다. 하지만 실제 제품에서는 체감도 중요하다. 사용자가 import 직후 타임라인을 스크롤하고, region을 드래그하고, 편집 동작을 했을 때 불편함이 없다면 그 자체로 의미 있는 관찰이다.

다만 이 관찰이 충분한 범위는 제한적이다.

직접 사용해봤을 때 불편함이 없었다면, 다음 판단에는 충분할 수 있다.

| 판단                                   | 체감 가능 여부 |
| -------------------------------------- | -------------- |
| 현재 UX가 당장 문제 없어 보인다        | 가능           |
| 추가 스케줄링을 당장 넣지 않는다       | 가능           |
| Web Worker 제거 판단을 보류한다        | 가능           |
| 성능 문제가 완전히 없다고 말한다       | 부족           |
| Web Worker 를 제거한다                 | 부족           |
| 모든 대용량 영상에서 안전하다고 말한다 | 부족           |

즉, 수동 검증은 제품 판단에는 도움이 된다. 하지만 아키텍처를 제거하거나 복잡도를 줄이는 결정을 하려면 더 좁은 질문에 답해야 한다.

내가 확인해야 했던 질문은 이것이었다.

> 썸네일 생성이 실제 편집 동작의 메인 스레드 응답성을 유의미하게 망가뜨리는가?

이 질문에 답하려면 단순히 전체 생성 시간이 아니라, 편집 중 UI 루프가 얼마나 막히는지를 봐야 했다.

## 3. 빠르다는 말의 의미를 다시 나누기

처음에는 썸네일 생성 경로를 비교할 때 총 생성 시간을 주로 봤다. 몇 장을 몇 초에 만들었는지를 보면 빠른 경로를 고를 수 있을 것 같았다. 하지만 작업을 진행하면서 빠르다는 말이 너무 넓다는 것을 알게 됐다. 여기서는 최소한 세 가지를 분리해야 했다.

| 기준             | 의미                                           |
| ---------------- | ---------------------------------------------- |
| 첫 시각적 피드백 | import 후 사용자가 처음 이미지를 보는 시간     |
| 전체 생성 시간   | 요청한 썸네일이 모두 준비되는 시간             |
| UI 응답성        | 생성 중 스크롤, 드래그, 입력이 얼마나 밀리는지 |

poster-first 구조는 첫 시각적 피드백을 줄이는 선택이다. 실제로 첫 region 표시 시간은 약 6.26초에서 2.82초로 줄었다. 약 55% 개선이다.

하지만 이 개선은 Web Worker 때문이라고 말하면 안 된다. 이 수치는 전체 썸네일을 기다리지 않고 poster 1장을 먼저 공유한 구조 변화의 결과에 가깝다.

Web Worker 의 역할은 다른 곳에 있었다.

Web Worker 가 정말 필요한지는 전체 생성 시간이 줄었는가보다 메인 스레드를 얼마나 덜 막았는가로 판단해야 했다.

## 4. 벤치마크를 다시 잡은 이유

초기 벤치마크는 HTMLVideoElement seek와 Web Worker /WebCodecs를 비교했다. 이후에는 Main/WebCodecs 경로도 추가했다. 이 비교가 필요했던 이유는 단순하다. Web Worker 가 빠른 이유가 WebCodecs 때문인지, 아니면 Web Worker 때문인지 분리해야 했기 때문이다. 그래서 세 경로를 나눴다.

| 경로                  | 의미                                                                |
| --------------------- | ------------------------------------------------------------------- |
| HTMLVideoElement seek | 브라우저 비디오 요소의 currentTime seek 후 frame capture            |
| Main/WebCodecs        | 메인 스레드에서 ArrayBuffer read, mp4box demux, VideoDecoder decode |
| Web Worker /WebCodecs | Web Worker 에서 ArrayBuffer read, mp4box demux, VideoDecoder decode |

Main/WebCodecs와 Web Worker /WebCodecs는 가능한 한 같은 방식으로 맞췄다. 파일을 ArrayBuffer로 읽고, mp4box로 demux하고, 선택한 sample을 VideoDecoder로 decode하는 흐름이다. 이렇게 해야 Web Worker 가 유리한 이유를 더 좁게 볼 수 있다.

## 5. Main busy와 Max stall

새로 본 지표는 Main busy와 Max stall이다.

이 글에서 Main busy는 실행 중 requestAnimationFrame 간격이 16.7ms를 초과한 누적 시간을 실행 시간으로 나눈 값이다. 16.7ms는 60fps 기준 한 프레임 예산이다.

정확히 말하면 이 값은 순수 JS 실행 시간만을 뜻하지 않는다. 렌더링, GC, bitmap 수신과 반영, 브라우저 내부 작업까지 섞일 수 있다. 그래서 메인 스레드 JS 블로킹이라고 단정하면 부정확하다.

더 정확한 표현은 다음과 같다.

> Main busy는 UI 루프 지연을 추정하는 대리 지표다.

Max stall은 측정 구간에서 관찰된 가장 긴 단일 프레임 간격으로, 최대 멈춤 시간을 의미한다. 이 값이 크면 사용자는 순간적인 멈춤으로 느낄 수 있다.

즉, 두 지표는 다음 질문에 답하기 위해 추가했다.

> 썸네일 생성 중 UI 루프가 얼마나 오래, 얼마나 자주 밀리는가?

## 6. 숫자가 바꾼 판단

위 내용을 바탕으로 테스트 페이지를 만들어서 다시 검증을 해보았다. 테스트 페이지 작성에는 자동화 도구의 도움을 받았고, 작성된 코드를 검수하는 방식으로 진행하였다. 자동화된 테스트 페이지 작성 보조를 활용하면 테스트 페이지 작성에 대한 심적 부담감이 확연히 줄어든다는 장점이 있었다.

100장 생성 기준 결과는 다음과 같았다.

| Mode                  | Total      | Avg/frame | Main busy | Max stall |
| --------------------- | ---------- | --------- | --------- | --------- |
| Web Worker /WebCodecs | 3936.61ms  | 39.37ms   | 11%       | 428.87ms  |
| Main/WebCodecs        | 4047.95ms  | 40.48ms   | 66%       | 1251.81ms |
| HTMLVideoElement seek | 20844.48ms | 208.44ms  | 0%        | 21.05ms   |

이 결과에서 중요한 점은 Web Worker /WebCodecs와 Main/WebCodecs의 전체 생성 시간이 거의 비슷하다는 것이다. Web Worker 가 압도적으로 빠르다고 말하기 어렵다. 하지만 Main busy와 Max stall은 다르다. Web Worker /WebCodecs는 Main busy가 11%였고, Main/WebCodecs는 66%였다. Max stall도 Web Worker 는 약 429ms, Main은 약 1252ms였다.

따라서 이 결과는 다음 해석과 일치한다.

> Web Worker 의 핵심 가치는 전체 처리 속도보다 UI 응답성 보호에 있다.

Web Worker 는 같은 WebCodecs 기반 처리를 메인 스레드 밖으로 옮긴다. 그래서 전체 생성 시간이 비슷하더라도, 사용자가 편집하는 동안 메인 스레드가 덜 막힐 수 있다.

## 7. HTMLVideoElement seek의 위치

HTMLVideoElement seek는 poster 1장에는 매우 강했다.

| Mode                  | Requested | First frame | Total     |
| --------------------- | --------- | ----------- | --------- |
| HTMLVideoElement seek | 1         | 50.29ms     | 51.2ms    |
| Web Worker /WebCodecs | 1         | 3163.29ms   | 3163.35ms |
| Main/WebCodecs        | 1         | 6143.84ms   | 6143.85ms |

이 수치는 poster-first 전략을 다시 뒷받침한다. 대표 이미지 1장을 빠르게 보여주는 목적이라면 HTMLVideoElement seek가 가장 적합하다. Web Worker /WebCodecs는 초기 demux와 decode 준비 비용이 있어서 1장 작업에는 불리하다. 하지만 HTMLVideoElement seek를 여러 장 생성에 쓰는 것은 조심해야 한다. 실험 중 10장 생성에서 912348.63ms라는 비정상값이 나왔다. 이 값은 일반적인 성능 판단에 그대로 넣으면 안 된다. seek queue가 멈췄는지, 측정 로직에 문제가 있었는지, 브라우저 decode stall이 있었는지 추가 확인이 필요하다. 그럼에도 방향은 분명했다.

| 용도                | 적합한 경로                            |
| ------------------- | -------------------------------------- |
| poster 1장          | HTMLVideoElement seek                  |
| visible tile 일부   | 상황에 따라 seek queue 또는 Web Worker |
| bulk thumbnail      | Web Worker /WebCodecs                  |
| Main/WebCodecs 단독 | UI 응답성 리스크 있음                  |

## 8. 실제 에디터 UI를 기준으로 다시 보기

벤치마크 페이지는 경로 비교에는 좋다. 하지만 실제 편집 경험을 완전히 대표하지는 않는다.

특히 region drag는 단순히 DOM element를 움직이는 작업이 아니다. 실제 에디터에서는 dnd-kit, placement 계산, interaction preview store, canvas redraw, commit command가 함께 움직인다. 그래서 실제 판단에는 E2E 테스트가 필요했다. 테스트에서 봐야 하는 것은 다음이다.

| 시나리오                         | 확인하려는 것                        |
| -------------------------------- | ------------------------------------ |
| import 직후 region drag          | thumbnail loading 중 편집이 막히는지 |
| thumbnails loaded 후 region drag | baseline 편집 성능                   |
| zoom level별 drag                | tile 수와 canvas redraw 비용 증가    |
| clip count별 drag                | track 수 증가에 따른 비용            |
| trim handle drag                 | resize preview와 commit 경로 비용    |

이 테스트는 Web Worker 가 필요한지 직접 증명하기보다, 실제 편집 경로에서 jank가 발생하는지 확인하는 장치다. 더 강한 결론을 내려면 같은 E2E를 strategy별로 돌려야 한다.

| 비교군                | 목적                          |
| --------------------- | ----------------------------- |
| Web Worker /WebCodecs | 현재 구조                     |
| Main/WebCodecs        | Web Worker 제거 가능성 확인   |
| thumbnail off         | thumbnail 외 비용 기준선 확인 |

이 비교가 있어야 썸네일 생성 때문에 밀린다와 타임라인 자체 redraw 비용 때문에 밀린다를 더 잘 구분할 수 있다.

## 9. background prefetch와 메모리 상한

두 번째 글에서는 화면 밖 썸네일 생성을 backfill이라고 불렀다. 이후 다시 생각해보니 더 정확한 표현은 background thumbnail prefetch에 가깝다.backfill은 빈 곳을 메운다는 느낌이 강하다. 실제 의도는 사용자가 아직 보지 않는 구간을 낮은 우선순위로 미리 만들어두는 것이다.

이 작업은 반드시 상한이 있어야 한다. Web Worker 에서 썸네일을 다 만든 뒤 한 번에 main thread로 보내면 순간 메모리 사용량이 커질 수 있다. 브라우저가 디스크 스왑으로 안전하게 처리해줄 것이라고 기대하면 안 된다. 필요한 방어선은 다음과 같다.

| 방어선               | 이유                                   |
| -------------------- | -------------------------------------- |
| batch 전송           | ImageBitmap이 한 번에 몰리는 상황 방지 |
| cache 상한           | 긴 영상에서 메모리 증가 방지           |
| in-flight dedupe     | 같은 timestamp 중복 생성 방지          |
| stale result discard | scroll, zoom 이후 늦게 온 결과 무시    |
| ImageBitmap.close    | 사용하지 않는 bitmap 리소스 해제       |
| abort 처리           | import 취소, undo, 프로젝트 전환 대응  |

여기서 중요한 점은 Web Worker 를 쓴다고 메모리 문제가 사라지지 않는다는 것이다. Web Worker 는 메인 스레드 점유를 줄일 수 있지만, 결과 bitmap과 cache는 여전히 관리해야 한다.

## 10. 최종 선택

현재 기준에서 선택한 구조는 다음과 같다.

정리하면 다음과 같다.

| 선택                                | 이유                          | 비용                                        |
| ----------------------------------- | ----------------------------- | ------------------------------------------- |
| poster-first 유지                   | 첫 시각적 피드백이 가장 빠름  | poster와 thumbnail cache 분리 필요          |
| Web Worker /WebCodecs 유지          | Main busy와 Max stall 감소    | Web Worker message, abort, memory 관리 필요 |
| HTMLVideoElement seek는 poster 중심 | 1장 생성이 매우 빠름          | 여러 장 seek는 불안정 가능성                |
| background prefetch는 낮은 우선순위 | 화면 밖 탐색 경험 보완        | 상한 없으면 메모리 위험                     |
| E2E로 실제 UI 검증                  | synthetic benchmark 한계 보완 | 테스트 환경과 selector 관리 필요            |

이 구조는 가장 단순한 구조는 아니다. 하지만 현재 관찰한 수치에서는 Main/WebCodecs 단독 전환보다 더 안전하다.

특히 Web Worker /WebCodecs와 Main/WebCodecs의 전체 처리 시간이 비슷한데도 Main busy가 크게 다르다는 점이 중요했다.

Web Worker 는 속도 최적화 도구라기보다 UI 응답성 보호 장치에 가깝다.

## 11. 아직 단정하지 않은 것

이번 측정으로 모든 결론이 끝난 것은 아니다. 아직 단정하지 않은 것은 다음과 같다.

| 남은 질문                              | 필요한 확인                                      |
| -------------------------------------- | ------------------------------------------------ |
| HTMLVideoElement seek 10장 이상치 원인 | timeout, seek queue, decode stall 분리           |
| Web Worker 가 모든 환경에서 유리한가   | 저사양 PC, 긴 영상, 4K 영상 측정                 |
| memory leak이 없는가                   | 반복 import, undo, project switch 후 메모리 추적 |
| E2E jank의 원인이 thumbnail인가        | Web Worker/Main/off 비교군                       |
| cache 상한이 적절한가                  | viewport 이동 패턴과 영상 길이별 관찰            |

그래서 현재 결론은 단정짓는것이 아닌, 이 정도가 정확한 표현이다.

> 지금 수치에서는 Web Worker 제거보다 Web Worker유지가 더 타당하다.

## 12. 마치며

세번의 썸네일 생성 최적화를 거치며 가장 크게 바뀐 관점은 “썸네일을 얼마나 빨리 많이 만들 것인가”에서 “사용자가 먼저 체감하는 구간을 어떻게 안정적으로 보여줄 것인가”로 이동한 것이다.

처음에는 Web Worker 를 쓰면 썸네일 생성이 빨라질 것이라고 생각했다. 그래서 관심은 주로 전체 생성 시간에 있었다. 하지만 측정해보니 Web Worker 는 항상 빠른 해법이 아니었다. 10장처럼 작업량이 작을 때는 오히려 seek보다 느렸고, 60장처럼 작업량이 커졌을 때 이점이 분명해졌다. 여기서 중요한 기준은 “Worker가 빠른가”가 아니라, 어떤 작업량과 어떤 목적에서 Web Worker 가 유리한가였다.

그 다음에는 전체 생성 시간보다 첫 시각적 피드백이 더 중요하다는 쪽으로 관점이 바뀌었다. 사용자는 모든 썸네일이 완성되는 시점보다, import 직후 타임라인에 영상이 보이기 시작하는 시점을 먼저 체감한다. 그래서 전체를 Web Worker 에 맡기는 것보다, poster 또는 첫 1장을 먼저 보여주고 나머지를 점진적으로 채우는 구조가 더 적합했다. 이때부터 성능 최적화의 기준은 총 처리 시간이 아니라 첫 화면 안정화 시간과 전체 완료 시간 사이의 균형이 되었다.

두 번째 시도에서는 생성 대상 자체를 다시 보게 되었다. 기존처럼 duration 기준으로 몇 장을 만들지 정하는 방식은 구현은 단순하지만, 사용자가 지금 보는 viewport와 맞지 않을 수 있었다. 그래서 “전체 영상에서 몇 장을 만들 것인가”가 아니라 “현재 화면에 필요한 tile을 먼저 어떻게 채울 것인가”가 더 중요한 질문이 되었다. 여기서 poster, visible tile, background prefetch를 분리하는 구조가 나왔다.

세 번째 시도에서는 Web Worker 의 의미를 다시 의심했다. 직접 써봤을 때 불편함이 없다면 Web Worker 를 빼도 되는 것 아닌지 고민했다. 하지만 Main/WebCodecs와 Worker/WebCodecs를 비교해보니 전체 생성 시간은 비슷해도 main busy와 max stall은 크게 달랐다. 이 결과로 Web Worker 의 가치는 단순한 생성 속도가 아니라 메인 스레드 UI 응답성을 보호하는 것에 있다는 쪽으로 관점이 정리됐다.

결국 중요한 것은 다음 세 가지였다.

첫째, 사용자가 먼저 보는 것과 나중에 볼 수 있는 것을 분리하는 것이다. poster와 visible tile은 빠르게 보여줘야 하고, 화면 밖 썸네일은 낮은 우선순위로 제한적으로 처리해도 된다.

둘째, 속도 지표를 하나로 보지 않는 것이다. first-region, generated, main busy, max stall은 서로 다른 질문에 답한다. 전체 생성 시간이 빠르다고 첫 화면이 빠른 것은 아니고, 생성 시간이 비슷하다고 UI 응답성이 같은 것도 아니다.

셋째, 최적화의 이득과 구조적 복잡도를 함께 보는 것이다. Web Worker, queue, abort, stale check, cache 상한은 모두 비용이 있다. 따라서 구조를 계속 복잡하게 만드는 것이 목표가 아니라, E2E와 메모리 관찰을 통해 어디까지가 필요한 복잡도인지 판단해야 한다.

이제 남은 작업은 구조를 더 복잡하게 만드는 것이 아니다. 오히려 반대로, E2E와 메모리 관찰을 통해 현재 구조에서 정말 필요한 복잡도와 덜어낼 수 있는 복잡도를 구분해야 한다. 세번의 작업을 통해 성능 최적화는 무조건 더 빠른 코드를 찾는 일이 아니라는 것을 배웠다. 사용자가 먼저 체감하는 구간과 나중에 처리해도 되는 구간을 나누고, 실제로 필요한 최적화인지 판단해야 한다. 동시에 함께 일하는 개발자들과 미래의 내가 이 코드를 다시 봤을 때 쉽게 이해할 수 있는지, 인계 비용과 러닝커브까지 고려해야 한다. 결국 중요한 것은 속도만이 아니라,

> 성능 개선이 가져오는 이득과 구조적 복잡도 사이의 트레이드오프를 판단하는 일이었다.

이전 글:

- [썸네일 생성 최적화 시도1] Web Worker 를 이용한 썸네일 생성 최적화: [https://insight74278.tistory.com/42](https://insight74278.tistory.com/42)
- [썸네일 생성 최적화 시도2] 썸네일 생성 구조 재설계하기: [https://insight74278.tistory.com/49](https://insight74278.tistory.com/49)
