---
title: '[Part 1.] 첫 화면과 전체 썸네일을 따로 최적화하기'
description: '첫 화면은 HTMLVideoElement seek로 빠르게 채우고, 나머지는 Web Worker에서 생성하도록 나눈 과정을 정리합니다.'
date: '2026-04-17'
publishedAt: '2026-04-17T14:26:22+09:00'
tags: ['performance', 'thumbnail', 'web-worker', 'editor']
series:
  name: '썸네일 생성 최적화'
  order: 1
draft: false
---

## [sort1] 1. 썸네일이 모두 만들어질 때까지 타임라인이 비어 있었다

비디오를 import하면 타임라인에 장면별 썸네일이 표시된다. 문제는 생성이 끝나기 전까지 타임라인이 비어 보였다는 점이다. 사용자는 이 상태에서 import가 끝났는지, 영상이 정상적으로 로드됐는지 판단하기 어려웠다.

처음에는 전체 생성 시간만 줄이면 된다고 생각했다. demux와 프레임 생성 파이프라인을 Web Worker에서 제어하면 해결될 것 같았다. 하지만 실험을 거치며 목표가 두 개라는 것을 알게 되었다.

1. **첫 시각적 피드백:** 타임라인에 첫 이미지가 언제 나타나는가
2. **전체 생성 시간:** 필요한 썸네일이 언제 모두 준비되는가

결론부터 말하면, 한 가지 경로로 두 목표를 모두 만족시키기는 어려웠다. 이 프로젝트에서는 **대표 이미지 1장은 `HTMLVideoElement` seek로 먼저 만들고, 나머지는 Web Worker에서 생성하는 방식**이 가장 균형이 좋았다.

다만 이 글에서 측정한 것은 첫 표시 시간과 전체 생성 시간이다. Web Worker가 실제 편집 중 UI 응답성을 얼마나 보호하는지는 이 시점에 분리해서 측정하지 못했다. 이 질문은 Part 3에서 다시 검증한다.

## [sort1] 2. 먼저 “빠르다”의 기준을 나눴다

성능을 하나의 숫자로 보면 서로 다른 문제가 섞인다. 이 글에서는 다음 세 지표를 구분한다.

| 지표                | 답하려는 질문                                 | 이 글의 측정 범위 |
| ------------------- | --------------------------------------------- | ----------------- |
| 첫 이미지 표시 시간 | 사용자는 언제 로딩이 진행 중임을 알 수 있는가 | 측정함            |
| 전체 생성 시간      | 요청한 썸네일은 언제 모두 준비되는가          | 측정함            |
| UI 응답성           | 생성 중 스크롤과 드래그가 얼마나 밀리는가     | 후속 검증 필요    |

첫 이미지가 빨리 보여도 전체 생성은 오래 걸릴 수 있다. 반대로 전체 생성 시간이 짧아도 완료 직전까지 화면이 비어 있으면 체감은 느릴 수 있다. 따라서 두 지표를 함께 비교해야 했다.

## [sort1] 3. 첫 비교는 작업량부터 달랐다

초기 가설은 단순했다.

> 썸네일 디코딩을 Web Worker로 옮기면 생성 시간이 줄어들 것이다.

Web Worker 경로를 구현한 뒤 첫 로그를 봤지만, 비교 조건이 같지 않았다.

- `HTMLVideoElement` seek 경로: 10장 생성
- Web Worker 경로: 60장 생성

이 값으로는 어느 경로가 더 빠른지 판단할 수 없다. 작업량이 다르기 때문이다. 코드보다 측정 조건을 먼저 바로잡아야 했다.

다시 측정할 때는 입력 파일, 브라우저 세션, 생성 개수를 동일하게 맞췄다. 기록한 시점도 분리했다.

- `generated`: 요청한 썸네일이 모두 생성된 시점
- `first-thumbnail-visible`: 첫 썸네일이 표시된 시점
- `first-region-drawn-on-track-row`: 타임라인에 첫 비디오 구간이 그려진 시점

아래 수치는 이 조건에서 기록한 값이다. 다른 코덱, 브라우저, 기기에서도 같은 결과가 나온다고 일반화할 수는 없다.

## [sort1] 4. 적은 작업에서는 seek, 많은 작업에서는 Worker가 빨랐다

같은 개수를 생성하자 작업량에 따라 결과가 달라졌다.

| 생성 개수 | `HTMLVideoElement` seek | Web Worker | 관찰 결과                |
| --------- | ----------------------: | ---------: | ------------------------ |
| 10장      |               4,246.2ms |  6,381.2ms | seek가 2,135ms 빨랐다    |
| 60장      |              13,394.1ms |  7,028.9ms | Worker가 약 47.5% 빨랐다 |

10장에서는 Web Worker가 오히려 느렸다. Worker 시작, 메시지 전달, demux와 decoder 준비 같은 고정 비용이 작은 작업에서 더 크게 드러난 결과와 일치한다. 다만 이 측정만으로 각 비용의 비중까지 분리했다고 말할 수는 없다.

60장에서는 Web Worker 경로가 약 6.37초 빨랐다. 적어도 이 테스트 환경에서는 **처리량이 커질 때 Web Worker 경로가 전체 생성 시간에 유리했다.**

여기서 첫 판단을 수정했다.

> Web Worker는 항상 빠른 경로가 아니라, 초기 비용을 감수할 만큼 작업량이 클 때 유리한 경로였다.

## [sort1] 5. Worker만 사용하자 첫 화면이 6초 넘게 비었다

전체 생성 시간만 보면 60장을 Web Worker에서 만드는 방식이 좋았다. 그러나 사용자는 완료 시간보다 먼저 빈 타임라인을 보게 된다. Worker가 첫 결과를 전달할 때까지 기다리면 첫 비디오 구간이 6.26초 뒤에 나타났다.

이 문제를 풀기 위해 [veed.io](https://www.veed.io)의 점진 표시 방식을 참고했다. 대표 이미지로 레이아웃을 먼저 채우고, 실제 프레임이 준비되는 순서대로 교체하는 방식이었다.

핵심은 모든 결과를 더 빨리 만드는 것이 아니었다.

> 완성된 결과를 한 번에 보여주지 않고, 최소한의 시각적 피드백을 먼저 보여준다.

## [sort1] 6. 첫 작업과 대량 작업을 분리했다

세 가지 전략을 같은 조건에서 비교했다.

| 전략               | 동작                               | 첫 비디오 구간 표시 | 전체 생성 | 판단                                |
| ------------------ | ---------------------------------- | ------------------: | --------: | ----------------------------------- |
| Worker 우선        | 처음부터 끝까지 Worker에서 생성    |           6,262.2ms | 7,213.3ms | 전체는 빠르지만 첫 표시가 늦음      |
| seek 1장 → Worker  | 1장을 seek로 표시한 뒤 Worker 실행 |           2,815.8ms | 7,352.5ms | 첫 표시와 전체 시간의 균형이 좋음   |
| seek 10장 → Worker | 10장을 seek로 만든 뒤 Worker 실행  |           2,513.1ms | 9,193.4ms | 첫 표시는 가장 빠르지만 전체가 늦음 |

`seek 1장 → Worker` 전략은 Worker 우선 전략과 비교해 첫 표시 시간을 약 55% 줄였다. 전체 생성 시간은 약 1.9% 늘었다.

`seek 10장 → Worker`는 첫 표시가 약 303ms 더 빨랐지만, 전체 생성은 `seek 1장 → Worker`보다 약 1.84초 늦었다. 첫 화면에 필요한 것은 대표 이미지 한 장이었으므로 10장을 먼저 만들 이유가 부족했다.

그래서 다음 순서를 선택했다.

```mermaid
flowchart LR
  A["비디오 import"] --> B["seek로 대표 이미지 1장 생성"]
  B --> C["타임라인에 즉시 표시"]
  C --> D["Web Worker에서 나머지 생성"]
  D --> E["준비된 프레임부터 점진 교체"]
```

이 선택은 Worker와 seek 중 하나가 절대적으로 우수하다는 뜻이 아니다. **작은 초기 작업과 큰 후속 작업에 서로 다른 경로를 배정한 것**이다.

## [sort1] 7. 빠른 경로보다 완료 가능한 경로를 먼저 만들었다

비디오 코덱과 브라우저 지원 범위가 다르기 때문에 Web Worker 경로가 항상 성공한다고 가정할 수 없었다. 실패해도 썸네일 생성을 완료하도록 세 단계의 fallback을 두었다.

```text
Web Worker 성공 → 완료
Web Worker 실패 또는 빈 결과 → HTMLVideoElement seek로 전체 재시도
seek도 실패 → FFmpeg 경로로 재시도
```

이 구조의 목표는 모든 환경에서 최고 속도를 보장하는 것이 아니다. 빠른 경로를 사용할 수 없는 환경에서도 썸네일이 비어 있는 상태로 끝나지 않게 하는 것이다.

### [sort2] 7-1. 이전 요청의 결과를 구분했다

import, 취소, 재시작이 연달아 발생하면 이전 요청의 진행 이벤트가 새 요청보다 늦게 도착할 수 있다. 이를 막기 위해 모든 요청과 응답에 `sourceId`를 포함했다.

```ts
type ThumbnailWorkerRequest =
  | { type: 'generate'; sourceId: string; videoBuffer: ArrayBuffer; thumbnailCount: number }
  | { type: 'abort'; sourceId: string };

type ThumbnailWorkerResponse =
  | { type: 'progress'; sourceId: string; bitmaps: ImageBitmap[]; times: number[] }
  | { type: 'complete'; sourceId: string }
  | { type: 'error'; sourceId: string; message: string };
```

메인 스레드는 현재 `sourceId`와 다른 응답을 반영하지 않는다. 이 검사는 Worker의 병렬 실행 자체를 제한하는 mutual exclusion이 아니다. **늦게 도착한 이전 결과를 현재 상태에서 제외하는 요청 식별 규칙**이다.

### [sort2] 7-2. 취소할 때 네 경로를 함께 정리했다

요청을 취소할 때는 다음 작업을 한 묶음으로 처리했다.

1. `AbortController`로 파일 읽기나 fetch를 취소한다.
2. Worker에 해당 `sourceId`의 `abort` 메시지를 보낸다.
3. 메인 스레드의 message listener를 제거한다.
4. 대기 중인 Promise를 reject해 호출자가 종료를 인식하게 한다.

Worker는 취소된 `sourceId`의 후속 진행 이벤트를 보내지 않는다. listener와 Promise까지 함께 정리해야 다음 import에서 이전 요청의 이벤트가 섞이거나 대기 상태가 남지 않는다.

### [sort2] 7-3. 결과는 한 번에 모으지 않고 점진적으로 보냈다

Worker 내부 파이프라인은 다음 순서로 동작했다.

```text
ArrayBuffer 입력
→ MP4 demux
→ 목표 프레임 decode
→ ImageBitmap 생성
→ progress 메시지로 전달
```

`ArrayBuffer`와 `ImageBitmap`은 가능한 경우 Transferable로 전달해 복사 비용을 피했다. 모든 프레임이 끝날 때까지 기다리지 않고, 준비된 `ImageBitmap`부터 `progress` 메시지로 보냈다.

생성 순서도 전체 구간을 성긴 간격으로 먼저 채운 뒤 그 사이를 채우도록 나눴다. 이 방식은 전체 완료 시간을 줄인다고 단정할 수는 없지만, 타임라인 전 구간에 시각적 정보가 점진적으로 분포되도록 한다.

<details>
<summary>성긴 간격을 먼저 생성하는 예시 코드</summary>

```ts
const coarseInterval = interval * 4;
const coarseTimestamps: number[] = [];

for (let time = 0; time < duration; time += coarseInterval) {
  coarseTimestamps.push(time);
}

const fineTimestamps: number[] = [];

for (let time = 0; time < duration; time += interval) {
  const isAlreadyIncluded = coarseTimestamps.some(coarseTime => Math.abs(coarseTime - time) < interval * 0.5);

  if (!isAlreadyIncluded) {
    fineTimestamps.push(time);
  }
}
```

</details>

## [sort1] 8. 확인한 결과와 아직 확인하지 못한 결과

선택한 `seek 1장 → Worker` 전략을 기존 60장 seek 경로와 비교하면 전체 생성 시간은 13,394.1ms에서 7,352.5ms로 약 45.1% 줄었다.

첫 표시 시간은 Worker 우선 경로와 비교해야 한다. 같은 하이브리드 실험에서 6,262.2ms에서 2,815.8ms로 약 55% 줄었다. 기존 60장 seek 경로의 첫 표시 값은 제시된 측정에 없으므로, 그 경로보다 몇 퍼센트 개선됐다고 말할 수는 없다.

| 판단                                                                  | 근거 상태                      |
| --------------------------------------------------------------------- | ------------------------------ |
| 60장 전체 생성은 하이브리드 경로가 기존 seek보다 빨랐다               | 측정으로 확인                  |
| Worker 우선보다 대표 이미지 1장을 먼저 보여주는 편이 첫 표시가 빨랐다 | 측정으로 확인                  |
| Web Worker가 편집 중 UI 응답성을 개선했다                             | 이 글의 측정만으로는 결론 불가 |
| 모든 파일과 기기에서 같은 비율로 개선된다                             | 결론 불가                      |

이 구분은 중요했다. 전체 생성 시간이 줄었다는 사실만으로 메인 스레드의 입력 지연까지 줄었다고 추론할 수는 없다.

## [sort1] 9. 한 가지 최적화보다 작업의 목적을 나누는 편이 중요했다

처음에는 “Web Worker를 쓰면 더 빠르다”는 답을 기대했다. 실제 결론은 달랐다.

- 대표 이미지 1장에는 Worker의 초기 비용이 컸다.
- 많은 썸네일을 만들 때는 Worker 경로의 전체 생성 시간이 짧았다.
- 사용자는 전체 완료보다 첫 시각적 피드백을 먼저 체감했다.
- 빠른 경로가 실패할 수 있으므로 fallback과 취소 규칙이 필요했다.

> 최적화의 단위는 기술이 아니라 사용자가 기다리는 단계였다.

이 판단 뒤에는 “영상 전체에서 몇 장을 만들 것인가”라는 질문이 남았다. Part 2에서는 생성 개수 대신 현재 화면을 기준으로 썸네일 작업을 다시 나눈다.

## 참고

- [Web Workers API](https://developer.mozilla.org/ko/docs/Web/API/Web_Workers_API)
- [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap)
- [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
