---
title: '[Part 1.] Web Worker를 이용한 썸네일 생성 최적화'
description: '비디오 썸네일 생성 지연을 줄이기 위해 Web Worker 전략을 적용하고 측정한 과정을 정리합니다.'
date: '2026-04-17'
publishedAt: '2026-04-17T14:26:22+09:00'
tags: ['performance', 'thumbnail', 'web-worker', 'editor']
series:
  name: '썸네일 생성 최적화'
  order: 1
draft: false
---

썸네일 최적화 시도 시리즈는 총 3편으로, 잘못된 판단으로 삽질을 하고, 스스로에게 질문하고 수정해나가는 과정을 담았습니다. 다음 글들은 아래 링크에서 보실 수 있습니다.

- [[Part 2.] 썸네일 생성 구조 재설계하기](/posts/thumbnail-optimization-structure-redesign)
- [[Part 3.] Web Worker를 다시 의심하고 검증하기](/posts/thumbnail-optimization-worker-verification)

## [sort1] 1. 들어가며

비디오를 에디터에 임포트하면 타임라인에 썸네일이 그려진다. 이 구간이 지연되면 편집을 시작할 수 있는 시점이 함께 늦어지고, 초기 체감 속도에 그대로 영향을 준다. 이번 작업의 목표는 세 가지였다.

- 썸네일 전체 생성 시간을 줄인다.
- 첫 썸네일이 보이는 시점을 앞당긴다.
- 빠른 경로가 실패해도 안전하게 복구한다.

결론부터 적으면, 처음부터 끝까지 Web Worker만 사용하는 방식보다 "첫 1장은 seek, 나머지는 Web Worker"로 나눈 전략이 가장 균형이 좋았다. 하지만 여기에 도달하기까지 측정 조건을 두 번 바로잡아야 했고, 중간에 한 번 엎었다. 그 과정을 이 글에 정리했다. Web Worker는 웹 애플리케이션의 메인 실행 스레드와 분리된 백그라운드 스레드에서 스크립트를 실행할 수 있게 해주는 간단한 수단이다. 이점은 스레드 자체가 별도로 실행되기 때문에 메인(보통 UI) 스레드의 동작이 느려지거나 중단되지 않는다는 것이다. 출처: MDN - Web Workers API

## [sort1] 2. 가설과 측정 조건

### [sort2] 2-1. 초기 가설

초기 가설은 단순했다.

> 썸네일 생성은 무거운 작업이므로, Web Worker로 옮기면 성능이 개선될 것이다.

실험을 진행해보니 이 가설은 일부 조건에서만 맞았다. 핵심은 "항상 빠른가"가 아니라 "어떤 조건에서 빠른가"였다.

### [sort2] 2-2. 측정 조건 불일치

Web Worker 경로를 붙이고 첫 로그를 확인했을 때, 결과가 기대와 다르게 나왔다. 자세히 보니 비교 기준 자체가 달랐다.

- seek 경로: 10장 생성
- Web Worker 경로: 60장 생성

같은 작업량이 아닌 상태에서 총 시간을 나란히 놓고 비교하고 있었다. "Web Worker가 빠르다"든 "느리다"든 판단할 수 있는 데이터가 아니었다. 성능 실험에서 가장 먼저 의심해야 하는 것은 코드가 아니라 측정 조건이라는 걸 여기서 다시 확인했다.

### [sort2] 2-3. 조건과 지표 재정의

그래서 측정 조건부터 다시 잡았다.

- 입력 파일: `YTDown.com_YouTube_Media_4CLWuZ3403k_001_1080p.mp4`
- 실행 환경: localhost, 동일 브라우저 세션
- 비교 방식: seek/Web Worker 모두 동일한 썸네일 개수로 측정
- 관찰 로그: 콘솔 perf 로그 + 성능 패널 장기 작업 구간

지표도 하나가 아니라 세 개로 분리했다.

- `[thumbnail] perf(generated)`: 전체 생성 완료 시점
- `[thumbnail] perf(first-thumbnail-visible)`: 첫 썸네일이 화면에 처음 보인 시점
- `[thumbnail] perf(first-region-drawn-on-track-row)`: 트랙 행에 첫 구간이 그려진 시점

지표를 분리하고 나니, 단순 총 시간 비교가 아니라 병목이 어느 구간에 있는지가 보이기 시작했다.

개선 전 10장, 60장

10장 기준 dom seek 이용 시 콘솔 측정 결과

10장 기준 dom seek 이용 시 성능 측정 결과

60장 기준 dom seek 이용 시 콘솔 측정 결과

60장 기준 dom seek 이용 시 성능 측정 결과

## [sort1] 3. 측정 결과

조건을 맞춘 뒤 다시 측정했더니, Web Worker의 성격이 꽤 선명하게 드러났다.

| 구간 | seek      | Web Worker | 해석                                              |
| ---- | --------- | ---------- | ------------------------------------------------- |
| 10장 | 4246.2ms  | 6381.2ms   | 소량에서는 Web Worker 오버헤드가 커서 오히려 불리 |
| 60장 | 13394.1ms | 7028.9ms   | 고처리량에서는 Web Worker가 유리 (약 47.5% 개선)  |

### [sort2] 3-1. 10장 비교

- seek: 4246.2ms
- Web Worker: 6381.2ms

Web Worker 초기화 비용과 메시지 직렬화 비용이 10장을 뽑는 작업량보다 크게 작용했다. 작은 작업을 Web Worker로 옮기면 오히려 손해가 된다는 걸 숫자로 확인한 구간이다.

개선 후 10장

10장 기준 Web Worker 이용 시 콘솔 측정 결과

10장 기준 Web Worker 이용 시 성능 측정 결과

### [sort2] 3-2. 60장 비교

- seek: 13394.1ms
- Web Worker: 7028.9ms

60장 구간에서는 결과가 뒤집혔다. 약 47.5% 개선, 대략 1.9배 수준이었다. 메인 스레드가 해야 할 일을 Web Worker가 대신 처리하는 구조이므로, 작업량이 많을수록 이득이 커지는 것은 자연스러운 결과였다.

개선 후 60장

60장 기준 Web Worker 이용 시 콘솔 측정 결과

60장 기준 Web Worker 이용 시 성능 측정 결과

정리하면, Web Worker는 만능 해법이 아니라 처리량이 커질수록 이득이 커지는 전략이었다.

## [sort1] 4. 하이브리드 전략 실험

### [sort2] 4-1. 체감 지표 재정의

여기서 한 번 멈춰 생각하게 되었다. 60장을 7초에 끝내든 13초에 끝내든, 사용자가 먼저 체감하는 것은 "내 영상이 타임라인에 보이기 시작한 순간"이다. 총 시간이 아무리 짧아도 첫 화면이 6초 동안 텅 비어 있다면 체감은 느리다. 즉, 편집기 관점에서 핵심 지표는 두 가지였다.

- 첫 화면이 언제 보이는가
- 전체 작업이 언제 끝나는가

두 지표는 트레이드오프 관계에 있다.

### [sort2] 4-2. 레퍼런스: veed.io

이 지점에서 veed.io의 업로드 UX를 참고했다. veed.io는 업로드 직후 타임라인이 같은 썸네일 한 장으로 먼저 채워져 보이고, 이후 실제 프레임이 준비되는 순서대로 한 장씩 교체된다. 핵심은 "완성을 기다리게 하는" 대신 **"레이아웃을 먼저 안정화하고, 내용물은 점진적으로 교체"**하는 방식이었다. 레퍼런스 - veed.io는 초기에 동일 썸네일로 레이아웃을 먼저 안정화한 뒤, 실제 프레임으로 순차 교체한다.

다운로드

### [sort2] 4-3. 세 전략 측정

이 UX를 반영하려면 Web Worker에만 전부 맡겨서는 부족했다. 첫 1장 정도는 seek로 먼저 깔고, 나머지를 Web Worker에 맡기는 구조를 실험해봐야 했다. 그래서 전략을 세 가지로 나눠 측정했다.

- A: worker-first: 처음부터 끝까지 Web Worker로 생성
- B: seek-first-1-then-worker: t=0 기준 1장을 seek로 먼저 생성 후, 이어서 Web Worker로 전체 생성
- C: seek-first-10-then-worker: 앞 10장을 seek로 생성 후, 이어서 Web Worker로 나머지 생성

결과는 다음과 같았다.

| 전략                         | first-region | generated | 판단                                    |
| ---------------------------- | ------------ | --------- | --------------------------------------- |
| A: worker-first              | 6262.2ms     | 7213.3ms  | 총 시간은 좋지만 첫 노출이 늦다         |
| B: seek-first-1-then-worker  | 2815.8ms     | 7352.5ms  | 첫 노출 크게 개선 + 총 시간 손해 최소   |
| C: seek-first-10-then-worker | 2513.1ms     | 9193.4ms  | 첫 노출은 가장 빠르지만 총 시간 손해 큼 |

A는 총 시간은 깔끔했지만 첫 화면이 6초 넘게 비어 있었다. C는 첫 화면이 가장 빨랐지만, seek 10장을 선행하는 동안 Web Worker 작업이 밀리면서 전체 시간 손해가 컸다. B는 첫 화면 속도가 절반 이상 당겨지면서, 총 시간 손해는 A 대비 약 1~2% 수준이었다. 최종적으로 기본 전략을 B (seek-first-1-then-worker) 로 정했다. 이 선택의 기준은 단일 지표가 아니었다.

- 첫 화면 안정화 속도 (first-region)
- 전체 생성 완료 시간 (generated)
- 실패 시 폴백 안정성 (Web Worker → seek → FFmpeg)

세 기준을 동시에 만족하는 균형점이 B였다.

Web Worker 만 이용

첫 1장만 DOM seek

첫 10장만 DOM seek

## [sort1] 5. 구현 원칙

성능 경로를 추가할 때는 빠른 경로 자체보다 실패 시 복구 경로를 함께 설계하는 것이 중요했다. 코덱과 브라우저 편차를 고려하면, 최고 성능보다 안정적인 완료 경로가 먼저다.

### [sort2] 5-1. 폴백 체인

```text
Web Worker 성공 → 끝
Web Worker 결과가 비거나 실패 → seek로 전체 복구
seek도 실패 → FFmpeg로 폴백
```

썸네일이 한 장도 뜨지 않는 것보다, 느리더라도 전부 뜨는 쪽이 낫다.

### [sort2] 5-2. 메시지 필터링

에디터에서는 임포트/취소/재시작이 자주 반복된다. 여러 요청이 Web Worker에서 동시에 돌 수 있고, 이때 이전 요청의 progress 이벤트가 새 요청에 섞여 들어오면 썸네일이 깨진다. 그래서 sourceId 기준으로 progress/complete 이벤트를 필터링했다. 단순한 장치지만 이게 없으면 상태 추적이 금방 어려워진다.

### [sort2] 5-3. 취소 루틴 일관화

취소는 기능이 아니라 기본 동작으로 취급했다. 네 단계를 항상 함께 실행해서 누수를 막았다.

- fetch 취소 (AbortController)
- Web Worker에 abort 메시지 전송
- message listener 제거
- pending promise 종료

한 경로라도 정리가 빠지면 다음 요청에서 이벤트/메모리 누수로 이어진다.

## [sort1] 6. 구현 상세

원칙만으로는 감이 잡히지 않기 때문에, 실제 런타임에서 어떤 순서로 동작하는지를 기준으로 정리했다.

### [sort2] 6-1. 전략 선택 진입점

썸네일 생성의 진입점은 useThumbnailGenerator다. 여기서 전략을 선택한 뒤, 결과를 thumbnailCache에 점진적으로 반영한다.

- worker-first: 처음부터 Web Worker에 전체 생성 요청
- seek-first-1-then-worker: t=0 기준 1장을 seek로 생성 후 Web Worker로 이어서 생성
- 공통 규칙: Web Worker 결과가 비거나 실패하면 seek 전체 경로로 복구, seek도 실패하면 FFmpeg로 폴백

즉 전략 선택 → 진행 중 점진 반영 → 실패 시 단계별 복구를 한 함수에서 오케스트레이션한다.

```ts
if (strategy === 'seek-first-1-then-worker') {
  await generateInitialThumbnailsViaSeek(sourceId, objectUrl, 1, abortRef, fallbackDurationSec, markFirstVisible);
}

try {
  result = await generateThumbnailsInWorker({
    sourceId,
    objectUrl,
    targetThumbnailCount,
  });
} catch {
  result = await generateFixedCountViaSeek(sourceId, objectUrl, abortRef, fallbackDurationSec, markFirstVisible);
}

if (result.length === 0 && file && isFFmpegAvailable()) {
  result = await generateFixedCountViaFFmpeg(
    sourceId,
    objectUrl,
    file,
    abortRef,
    fallbackDurationSec,
    markFirstVisible
  );
}
```

### [sort2] 6-2. 메시지 프로토콜

메인 스레드와 Web Worker 사이 메시지는 단순하지만, 동시 요청 충돌을 막는 장치가 핵심이었다.

- 요청 메시지: generate, abort
- 응답 메시지: progress, complete, error
- 식별 키: sourceId

sourceId를 기준으로 수신 이벤트를 필터링해서, 이전 요청의 progress/complete가 현재 요청에 섞이지 않도록 했다.

```ts
// main → Web Worker
w.postMessage({ type: 'generate', sourceId, videoBuffer, targetThumbnailCount }, [videoBuffer]);
w.postMessage({ type: 'abort', sourceId });

// thumbnailWorkerClient
const onMessage = (event: MessageEvent<ThumbnailWorkerResponse>) => {
  const msg = event.data;
  if (msg.sourceId !== sourceId) {
    return;
  }
  // progress / complete / error 처리
};
```

### [sort2] 6-3. Web Worker 내부 파이프라인

Web Worker 내부에서는 대략 아래 순서로 처리한다.

- 비디오 버퍼 입력
- demux / 디코딩
- 목표 시점 프레임 추출
- ImageBitmap 생성
- progress 이벤트로 메인 스레드에 전달

ImageBitmap 인터페이스는 캔버스에 지연 없이 그릴 수 있는 비트맵 이미지를 나타낸다. 낮은 지연의 렌더링을 제공하기 위해 비동기적으로 생성될 수 있다. 출처: MDN - ImageBitmap 전달 비용을 줄이기 위해 가능한 한 Transferable 경로를 사용했다. 또한 모든 프레임을 한 번에 넘기지 않고 중간 결과를 쪼개서 보내, UI가 "완료까지 대기"하지 않도록 했다. 추가로, coarse 먼저 + fine으로 채우는 순서로 시점을 뽑는다. 타임라인 전체에 굵직한 간격으로 대표 프레임을 먼저 뿌려놓고, 그 사이 빈 구간을 이후에 채운다. 사용자는 타임라인이 골고루 채워지는 느낌을 먼저 받게 된다.

```ts
const coarseInterval = interval * 4;
const coarseTimestamps: number[] = [];
for (let t = 0; t < duration; t += coarseInterval) {
  coarseTimestamps.push(t);
}

const fineTimestamps: number[] = [];
for (let t = 0; t < duration; t += interval) {
  if (!coarseTimestamps.some(ct => Math.abs(ct - t) < interval * 0.5)) {
    fineTimestamps.push(t);
  }
}

self.postMessage({ type: 'progress', sourceId, bitmaps: [bitmap], times: [timeSec] }, [bitmap]);
```

### [sort2] 6-4. 취소와 정리

```ts
const abort = () => {
  abortController.abort();
  worker.postMessage({ type: 'abort', sourceId });
  worker.removeEventListener('message', onMessage);
  rejectPending(new Error('thumbnail generation aborted'));
};

// worker
if (msg.type === 'abort') {
  abortedSourceIds.add(msg.sourceId);
  return;
}
```

Web Worker는 abort 메시지를 받으면 해당 sourceId를 무시 목록에 넣고, 이후 progress를 내보내지 않는다. 메인에서는 listener 제거 + pending reject까지 함께 정리해, 중간 취소가 잦은 편집 흐름에서도 상태가 꼬이지 않게 했다.

### [sort2] 6-5. 점진 반영 UX

최종 UX는 "한 번에 완성"이 아니라 **"빠른 첫 노출 + 순차 치환"**에 맞췄다.

- 첫 1장은 seek로 빠르게 채워 레이아웃을 먼저 안정화
- 이후 Web Worker progress마다 캐시를 갱신하며 실제 프레임으로 교체
- 사용자는 빈 타임라인을 오래 보지 않고, 점점 정밀해지는 결과를 본다

이 방식 덕분에 first-region 지표를 크게 줄이면서도, 전체 생성 시간은 worker-first의 이점을 거의 그대로 유지할 수 있었다.

## [sort1] 7. 전체 구조

요약하면, 초기 노출 속도는 seek로 확보하고 전체 처리량은 Web Worker로 개선하는 구조다. 어느 한쪽이 실패해도 아래 단계가 받쳐준다.

## [sort1] 8. 결과

| 지표              | Before (seek 60장) | After (seek-first-1-then-worker) |
| ----------------- | ------------------ | -------------------------------- |
| first-region 노출 | 상대적으로 지연    | 2815.8ms                         |
| generated 총 시간 | 13394.1ms          | 7352.5ms (약 45% 단축)           |
| 실패 복구 경로    | seek 단일 경로     | Worker → seek → FFmpeg 3단 폴백  |
| 동시 요청 안전성  | 미보장             | sourceId 기반 필터링             |

첫 화면 노출 시점이 당겨지면서 "영상을 올렸는데 타임라인이 비어 있는 시간"이 체감상 크게 줄었고, 총 생성 시간도 절반 가까이 단축됐다. 동시에 Web Worker가 실패해도 seek, FFmpeg로 이어지는 폴백 경로를 갖추게 됐다.

## [sort1] 9. 마치며

이번 실험에서 가장 크게 배운 것은 단일 해법을 찾는 대신, 트레이드오프를 수치로 비교하고 제품 맥락에 맞는 균형점을 선택하는 과정이었다. Web Worker냐 seek냐의 문제가 아니라, "이 에디터에서 사용자가 무엇을 먼저 체감해야 하는가"라는 질문에 가까웠다. 추가적으로, 무거운 작업이 많은 웹 에디터 특성상, Web Worker로 메인 스레드 점유를 낮추면 썸네일 생성 속도뿐 아니라 에디터 전체 상호작용의 체감 성능까지 함께 개선된다는 점이 인상적이었다. 다음 단계에서는 MOV를 포함한 코덱별 실패 패턴을 더 모아, Web Worker를 언제 조기 중단하고 seek로 전환할지 기준을 자동화할 계획이다. 지금은 Web Worker가 실패한 다음에야 seek로 내려가는데, "성공하지 못할 것 같다"는 신호를 조금 더 빨리 감지하면 폴백 지연도 함께 줄일 수 있을 것이다. 또한 이번 작업을 계기로, 앞으로는 프로젝트 전반에서 Web Worker로 옮길 수 있는 작업들을 하나씩 더 찾아볼 생각이다. 단순히 처리 시간을 줄이는 것보다, 메인 스레드를 오래 붙잡는 구간을 줄여 작업 중 UI가 끊기는 느낌을 덜고, 전체 편집 반응성을 더 매끄럽고 안정적으로 만드는 방향에 집중해보려 한다.

## 참고

브라우저 API

- [Web Worker를 사용한 이미지 로딩](https://blog.rhostem.com/posts/2021-01-03-image-load-by-web-worker)
- [Web Worker](https://developer.mozilla.org/ko/docs/Web/API/Worker)
- [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Web Workers API](https://developer.mozilla.org/ko/docs/Web/API/Web_Workers_API)
- [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap)
- [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

레퍼런스 서비스

- [veed.io](https://www.veed.io)

썸네일 최적화 시도 시리즈는 총 3편으로, 잘못된 판단으로 삽질을 하고, 스스로에게 질문하고 수정해나가는 과정을 담았습니다. 다음 글들은 아래 링크에서 보실 수 있습니다.

- [[Part 2.] 썸네일 생성 구조 재설계하기](/posts/thumbnail-optimization-structure-redesign)
- [[Part 3.] Web Worker를 다시 의심하고 검증하기](/posts/thumbnail-optimization-worker-verification)
