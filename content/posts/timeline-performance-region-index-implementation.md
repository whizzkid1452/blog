---
title: '이진 탐색 기반 Region 시간 인덱스와 rAF Signal 구현하기'
description: 'Viewport 내 Region만 조회하는 시간 인덱스와 React 실행에서 Canvas draw를 분리하는 rAF 기반 Signal 구독 패턴을 단계별로 구현합니다.'
date: '2026-07-24'
tags: ['react', 'performance', 'timeline', 'canvas', 'typescript']
draft: false
visibility: public
---

## [sort1] 1. 구현 목표와 범위

이 글은 타임라인 스크롤 경로의 두 작업을 분리해 구현한다.

1. 화면 범위가 바뀔 때마다 모든 Region을 순회한다.
2. Canvas를 다시 그리기 위한 값이 TrackRow의 React prop까지 바꾼다.

왜 이진 탐색 기반 시간 인덱스와 rAF 기반 Signal 구독 패턴을 선택했는지는 [1,518개 Region 타임라인: 두 가지 최적화 적용 후 Long Task 73.9% 감소](/posts/timeline-performance-region-index-decision)에서 설명했다.

여기서는 다음 결과를 만든다.

```text
Region 목록 변경
→ 시간 인덱스 생성

가로 스크롤
→ 시간 인덱스에서 후보 조회
→ 같은 frame의 Canvas 갱신 요청을 한 번으로 합침
→ TrackRow를 다시 실행하지 않고 Canvas draw 함수 호출
```

예제는 핵심 메커니즘을 독립적으로 실행할 수 있도록 프로젝트 내부 이름과 부가 로직을 제거해 재구성했다. 따라서 실제 제품 코드의 전체 복사본은 아니다.

## [sort1] 2. 준비 사항과 불변 조건

예제는 다음 환경을 가정한다.

- TypeScript `strict` 모드
- React 함수 컴포넌트
- Vitest 또는 Jest와 호환되는 테스트 환경
- Region의 `start`와 `end`가 같은 시간 단위를 사용

예제 코드는 다음 파일로 나눈다.

```text
visible-region-index.ts
find-visible-regions.test.ts
visible-region-index.test.ts
scroll-frame-signal.ts
scroll-frame-signal.test.ts
timeline.tsx
```

Region 모델은 다음과 같다.

```ts
export interface TimelineRegion {
  id: string;
  start: number;
  end: number;
}

export interface TimeRange {
  start: number;
  end: number;
}
```

인덱스를 만들기 전에 다음 불변 조건을 정했다.

```text
Region: start <= end
화면 범위: start <= end
경계가 맞닿은 Region: 화면에 포함
조회 결과: 입력 배열의 렌더링 순서 유지
```

잘못된 시간 범위를 인덱스 내부에서 임의로 보정하면 데이터 오류를 숨길 수 있다. 이 예제에서는 생성 시점에 오류를 던진다.

## [sort1] 3. 기존 선형 조회의 역할부터 테스트로 고정했다

기존 조회는 모든 Region을 검사해 화면과 겹치는 항목을 반환했다.

```ts
export function findVisibleRegions(regions: TimelineRegion[], viewport: TimeRange): TimelineRegion[] {
  return regions.filter(region => {
    return region.end >= viewport.start && region.start <= viewport.end;
  });
}
```

비교 연산에 등호가 들어가는 이유는 화면 경계와 맞닿은 Region도 보이는 항목으로 취급하기 때문이다.

최적화 전에 이 동작을 테스트로 고정했다.

```ts
import { describe, expect, it } from 'vitest';
import { findVisibleRegions } from './visible-region-index';

describe('findVisibleRegions', () => {
  it('화면 경계와 맞닿은 Region을 포함한다', () => {
    const regions = [
      { id: 'before', start: 0, end: 10 },
      { id: 'after', start: 20, end: 30 },
    ];

    expect(findVisibleRegions(regions, { start: 10, end: 20 })).toEqual(regions);
  });
});
```

이 테스트는 성능을 검증하지 않는다. 인덱스로 조회 방식을 바꿔도 기존 경계 동작을 보존하는지 확인하는 회귀 테스트다.

## [sort1] 4. 시작 시간과 누적 최대 종료 시간으로 인덱스를 만들었다

### [sort2] 4-1. 시작 시간만 정렬하면 긴 Region을 놓칠 수 있다

Region을 시작 시간순으로 정렬하면 화면 종료 시점보다 늦게 시작하는 항목은 빠르게 제외할 수 있다. 하지만 화면 시작 시점보다 먼저 시작한 Region을 단순히 건너뛰면 안 된다.

```text
긴 Region: 0초 ───────────────────────── 100초
현재 화면:                         90초 ─ 95초
```

긴 Region은 현재 화면보다 훨씬 먼저 시작했지만 화면과 겹친다.

그래서 정렬된 각 위치에 **그 위치까지 등장한 Region의 최대 종료 시간**을 함께 저장한다.

```text
종료 시간:          [4, 100, 12, 30]
누적 최대 종료 시간: [4, 100, 100, 100]
```

누적 최대 종료 시간은 감소하지 않는다. 따라서 화면 시작 시간 이상인 첫 위치를 이진 탐색할 수 있다.

### [sort2] 4-2. 입력 순서를 보존할 정보를 함께 저장한다

인덱스 내부에서는 시작 시간순으로 정렬하지만, 조회 결과는 기존 렌더링 순서와 같아야 했다. 그래서 원래 배열 위치를 함께 저장한다.

```ts
interface IndexedRegion {
  region: TimelineRegion;
  originalIndex: number;
}

export interface VisibleRegionIndex {
  sortedRegions: IndexedRegion[];
  prefixMaxEnd: number[];
}
```

인덱스 생성 함수는 다음과 같다.

```ts
function assertValidRegion(region: TimelineRegion): void {
  if (region.start > region.end) {
    throw new RangeError(`Region "${region.id}"의 start가 end보다 큽니다.`);
  }
}

export function createVisibleRegionIndex(regions: TimelineRegion[]): VisibleRegionIndex {
  const sortedRegions = regions
    .map((region, originalIndex) => {
      assertValidRegion(region);
      return { region, originalIndex };
    })
    .sort((left, right) => {
      return left.region.start - right.region.start || left.originalIndex - right.originalIndex;
    });

  const prefixMaxEnd: number[] = [];
  let maximumEnd = Number.NEGATIVE_INFINITY;

  for (const indexedRegion of sortedRegions) {
    maximumEnd = Math.max(maximumEnd, indexedRegion.region.end);
    prefixMaxEnd.push(maximumEnd);
  }

  return {
    sortedRegions,
    prefixMaxEnd,
  };
}
```

같은 시작 시간을 가진 Region은 `originalIndex`로 순서를 고정한다. 이 규칙이 없으면 정렬 결과에 렌더링 순서를 맡기게 된다.

## [sort1] 5. 두 번의 이진 탐색으로 후보 범위를 좁혔다

### [sort2] 5-1. 왼쪽 경계는 누적 최대 종료 시간으로 찾는다

화면과 겹칠 가능성이 있는 첫 위치는 누적 최대 종료 시간이 화면 시작 시간 이상인 지점이다.

```ts
function findFirstValueAtLeast(values: number[], target: number): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);

    if (values[middle] >= target) {
      high = middle;
      continue;
    }

    low = middle + 1;
  }

  return low;
}
```

누적 최대 종료 시간이 화면 시작 시간보다 작은 위치까지는 이후 화면과 겹치는 Region이 존재할 수 없다.

### [sort2] 5-2. 오른쪽 경계는 시작 시간으로 찾는다

화면 종료 시간보다 늦게 시작하는 첫 Region부터는 화면과 겹칠 수 없다.

```ts
function findFirstRegionStartingAfter(regions: IndexedRegion[], target: number): number {
  let low = 0;
  let high = regions.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);

    if (regions[middle].region.start > target) {
      high = middle;
      continue;
    }

    low = middle + 1;
  }

  return low;
}
```

왼쪽과 오른쪽 경계 사이에는 화면과 겹칠 **가능성**이 있는 Region만 남는다. 누적 최대 종료 시간은 개별 Region의 종료 시간을 뜻하지 않으므로 후보마다 실제 교차 여부를 한 번 더 검사해야 한다.

### [sort2] 5-3. 후보를 검사하고 기존 순서를 복원한다

```ts
function assertValidRange(range: TimeRange): void {
  if (range.start > range.end) {
    throw new RangeError('화면 범위의 start가 end보다 큽니다.');
  }
}

export function queryVisibleRegions(index: VisibleRegionIndex, viewport: TimeRange): TimelineRegion[] {
  assertValidRange(viewport);

  const candidateStart = findFirstValueAtLeast(index.prefixMaxEnd, viewport.start);
  const candidateEnd = findFirstRegionStartingAfter(index.sortedRegions, viewport.end);

  return index.sortedRegions
    .slice(candidateStart, candidateEnd)
    .filter(({ region }) => {
      return region.end >= viewport.start && region.start <= viewport.end;
    })
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map(({ region }) => region);
}
```

인덱스 생성은 정렬 때문에 `O(N log N)`이다. 조회는 단순히 `O(log N)`으로 끝나지 않는다.

```text
이진 탐색: O(log N)
후보 검사: O(C)
결과 순서 복원: O(V log V)
```

`C`는 탐색으로 좁힌 후보 수, `V`는 실제 반환 수다. 이 구조가 유리하려면 Region 목록 변경보다 화면 범위 조회가 충분히 자주 발생해야 한다. Region을 한 건씩 자주 삽입하거나 삭제해야 한다면 동적 interval tree 같은 자료구조를 다시 비교해야 한다.

## [sort1] 6. 긴 Region과 경계 조건을 테스트했다

인덱스 테스트는 빠른 경우보다 놓치기 쉬운 경계를 먼저 확인했다.

```ts
import { describe, expect, it } from 'vitest';
import { createVisibleRegionIndex, queryVisibleRegions } from './visible-region-index';

describe('queryVisibleRegions', () => {
  it('화면보다 먼저 시작한 긴 Region을 반환한다', () => {
    const regions = [
      { id: 'short', start: 10, end: 20 },
      { id: 'long', start: 0, end: 100 },
      { id: 'outside', start: 101, end: 110 },
    ];
    const index = createVisibleRegionIndex(regions);

    expect(queryVisibleRegions(index, { start: 90, end: 95 })).toEqual([regions[1]]);
  });

  it('화면 경계와 맞닿은 Region을 포함한다', () => {
    const regions = [
      { id: 'left', start: 0, end: 10 },
      { id: 'right', start: 20, end: 30 },
    ];
    const index = createVisibleRegionIndex(regions);

    expect(queryVisibleRegions(index, { start: 10, end: 20 })).toEqual(regions);
  });

  it('조회 결과의 입력 순서를 유지한다', () => {
    const regions = [
      { id: 'late-start', start: 8, end: 12 },
      { id: 'early-start', start: 1, end: 20 },
    ];
    const index = createVisibleRegionIndex(regions);

    expect(queryVisibleRegions(index, { start: 10, end: 11 })).toEqual(regions);
  });

  it('잘못된 Region 범위를 거부한다', () => {
    expect(() => {
      createVisibleRegionIndex([{ id: 'invalid', start: 20, end: 10 }]);
    }).toThrow(RangeError);
  });
});
```

추가로 production 코드에서는 다음 사례도 고정하는 편이 안전하다.

- 빈 Region 배열
- 시작·종료 시간이 같은 0 길이 Region
- 모든 Region이 화면 밖에 있는 경우
- 같은 시작 시간을 가진 Region이 여러 개인 경우
- 음수 시간이나 `NaN`을 허용할지에 대한 도메인 정책

`NaN`과 무한대 허용 여부는 제품 정책이므로 이 예제에서 임의로 결정하지 않았다.

## [sort1] 7. Region 배열 참조가 바뀔 때 인덱스를 다시 만들었다

React에서는 `regions` 배열 참조가 바뀔 때 인덱스를 만들고, 스크롤 중에는 같은 인덱스를 조회한다.

```tsx
import { useMemo } from 'react';
import {
  createVisibleRegionIndex,
  queryVisibleRegions,
  type TimelineRegion,
  type TimeRange,
} from './visible-region-index';

interface TimelineRegionsProps {
  regions: TimelineRegion[];
  viewport: TimeRange;
}

export function TimelineRegions({ regions, viewport }: TimelineRegionsProps) {
  const visibleRegionIndex = useMemo(() => {
    return createVisibleRegionIndex(regions);
  }, [regions]);

  const { start: viewportStart, end: viewportEnd } = viewport;
  const visibleRegions = useMemo(() => {
    return queryVisibleRegions(visibleRegionIndex, {
      start: viewportStart,
      end: viewportEnd,
    });
  }, [visibleRegionIndex, viewportEnd, viewportStart]);

  return (
    <>
      {visibleRegions.map(region => (
        <div key={region.id}>{region.id}</div>
      ))}
    </>
  );
}
```

여기에는 중요한 전제가 있다.

> Region을 수정할 때 배열 참조도 새로 만들어야 한다.

기존 배열이나 Region 객체를 직접 변경하면 `regions` 참조가 유지돼 인덱스가 재생성되지 않을 수 있다. 이 구현에서는 불변 업데이트가 인덱스 정합성의 필요 조건이다.

화면 범위 조회는 `viewport` 객체 참조가 아니라 `viewportStart`와 `viewportEnd`를 의존성으로 사용한다. 상위 컴포넌트가 같은 범위의 객체를 다시 만들어도 조회를 반복하지 않기 위해서다.

## [sort1] 8. Canvas 갱신 요청을 전달하는 신호 객체를 만들었다

### [sort2] 8-1. 신호는 상태 대신 갱신 요청을 전달한다

스크롤 중 TrackRow에 필요한 것은 새로운 React UI 상태가 아니라 “현재 위치로 Canvas를 다시 그려라”라는 알림이었다.

```ts
export interface ScrollFrameSignal {
  subscribe(listener: () => void): () => void;
  emit(): void;
}

export function createScrollFrameSignal(): ScrollFrameSignal {
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}
```

`subscribe`는 반드시 해제 함수를 반환한다. `emit`에서는 listener가 실행 중 구독을 변경해도 현재 발행 순회가 흔들리지 않도록 snapshot을 사용했다.

기본 동작은 단위 테스트로 고정할 수 있다.

```ts
import { describe, expect, it, vi } from 'vitest';
import { createScrollFrameSignal } from './scroll-frame-signal';

describe('createScrollFrameSignal', () => {
  it('구독 중인 listener에만 알림을 전달한다', () => {
    const signal = createScrollFrameSignal();
    const listener = vi.fn();
    const unsubscribe = signal.subscribe(listener);

    signal.emit();
    unsubscribe();
    signal.emit();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

### [sort2] 8-2. 같은 frame의 갱신 요청을 한 번으로 합친다

wheel 이벤트가 짧은 시간에 여러 번 들어와도 이미 `requestAnimationFrame` 콜백을 예약했다면 추가 예약을 만들지 않는다.

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollFrameSignal() {
  const [signal] = useState(createScrollFrameSignal);
  const frameRequestIdRef = useRef<number | null>(null);

  const requestCanvasUpdate = useCallback(() => {
    if (frameRequestIdRef.current !== null) {
      return;
    }

    frameRequestIdRef.current = requestAnimationFrame(() => {
      frameRequestIdRef.current = null;
      signal.emit();
    });
  }, [signal]);

  useEffect(() => {
    return () => {
      if (frameRequestIdRef.current === null) {
        return;
      }

      cancelAnimationFrame(frameRequestIdRef.current);
    };
  }, []);

  return {
    signal,
    requestCanvasUpdate,
  };
}
```

예약 여부는 `0` 같은 숫자의 truthy 여부가 아니라 `null`과 비교한다. 컴포넌트가 unmount되면 예약된 콜백도 취소한다.

이 코드는 스크롤 이벤트 수를 줄이지 않는다. 같은 frame 안에서 발생한 Canvas 갱신 예약만 한 번으로 합친다. 신호를 받은 모든 TrackRow의 Canvas draw 함수는 계속 호출된다.

## [sort1] 9. TrackRow는 최신 draw 함수를 참조해 Canvas를 갱신한다

부모는 참조가 유지되는 `signal`을 TrackRow에 전달한다. TrackRow는 신호를 구독하고 Canvas draw 함수만 호출한다.

```tsx
import { memo, type UIEvent, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { type ScrollFrameSignal, useScrollFrameSignal } from './scroll-frame-signal';

interface UseCanvasUpdateOptions {
  signal: ScrollFrameSignal;
  drawCanvas: () => void;
}

function useCanvasUpdate({ signal, drawCanvas }: UseCanvasUpdateOptions): void {
  const drawCanvasRef = useRef(drawCanvas);

  useLayoutEffect(() => {
    drawCanvasRef.current = drawCanvas;
  }, [drawCanvas]);

  useEffect(() => {
    return signal.subscribe(() => {
      drawCanvasRef.current();
    });
  }, [signal]);
}

interface TimelineTrack {
  id: string;
}

interface LatestScrollPosition {
  current: number;
}

interface TrackRowProps {
  track: TimelineTrack;
  scrollFrameSignal: ScrollFrameSignal;
  scrollLeftRef: LatestScrollPosition;
}

export const TrackRow = memo(function TrackRow({ track, scrollFrameSignal, scrollLeftRef }: TrackRowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillText(`${track.id}: ${scrollLeftRef.current}px`, 8, 16);
  }, [scrollLeftRef, track.id]);

  useLayoutEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useCanvasUpdate({
    signal: scrollFrameSignal,
    drawCanvas,
  });

  return <canvas ref={canvasRef} width={320} height={40} aria-label={`${track.id} 타임라인`} />;
});

interface TimelineProps {
  tracks: TimelineTrack[];
}

export function Timeline({ tracks }: TimelineProps) {
  const { signal, requestCanvasUpdate } = useScrollFrameSignal();
  const scrollLeftRef = useRef(0);
  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      scrollLeftRef.current = event.currentTarget.scrollLeft;
      requestCanvasUpdate();
    },
    [requestCanvasUpdate]
  );

  return (
    <div onScroll={handleScroll}>
      {tracks.map(track => (
        <TrackRow key={track.id} track={track} scrollFrameSignal={signal} scrollLeftRef={scrollLeftRef} />
      ))}
    </div>
  );
}
```

`handleScroll`은 최신 가로 위치를 `scrollLeftRef`에 기록한 뒤 Canvas 갱신을 요청한다. React state를 바꾸지 않으므로 이 경로만으로는 부모와 TrackRow가 다시 실행되지 않는다.

신호 구독 effect에 `drawCanvas`를 직접 의존시키지 않은 이유는 draw 함수가 바뀔 때마다 구독을 해제하고 다시 등록하는 일을 피하기 위해서다. 대신 ref가 최신 함수를 가리키게 한다.

이 구조가 안전하려면 다음 조건이 필요하다.

- `signal` 참조가 스크롤마다 바뀌지 않아야 한다.
- unmount 시 구독이 해제돼야 한다.
- draw 함수가 사용하는 scroll 위치와 Canvas 참조가 최신 값이어야 한다.
- Canvas 갱신으로 React state를 다시 바꾸는 순환 경로가 없어야 한다.

React의 [`memo`](https://react.dev/reference/react/memo)는 props가 이전과 같을 때 컴포넌트 재렌더링을 건너뛸 수 있게 한다. 다만 `memo`는 보장된 동작 변경이 아니라 성능 최적화다. 다른 prop이나 context가 바뀌면 TrackRow는 다시 실행된다.

## [sort1] 10. 구현 결과를 세 단계로 검증했다

각 검증은 확인할 수 있는 범위가 다르다.

| 검증 단계            | 확인할 내용                                                 | 이 단계만으로 확인할 수 없는 내용            |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| 알고리즘 단위 테스트 | 긴 Region, 경계 포함, 입력 순서, 잘못된 범위 처리           | 사용자 입력 반응 시간                        |
| React 통합 테스트    | 스크롤 신호와 TrackRow 실행 경로의 분리                     | Canvas draw 시간과 앱 전체 React commit      |
| 실제 앱 비교 측정    | 고정 fixture에서 Long Task, 입력, CPU, React 지표의 전후 값 | 시간 인덱스와 Canvas 신호 각각의 독립 기여도 |

프로젝트의 React 통합 테스트에서는 15개 TrackRow에 240회 신호를 보냈다. 해당 테스트 구성의 예상값은 다음과 같았다.

```text
TrackRow 실행: 최초 15회
Canvas 갱신 함수 호출: 15 × 240 = 3,600회
```

이 결과는 스크롤 알림이 TrackRow의 React 실행을 반복하지 않으면서 Canvas 갱신 함수에는 전달되는지 확인한다. Canvas draw 성능은 실제 앱 측정이나 별도 draw profiler로 확인해야 한다.

같은 frame의 요청 병합은 `requestAnimationFrame`을 stub으로 주입해 단위 테스트할 수 있다. 브라우저 전역 함수와 테스트를 분리해야 한다면 다음 의존성을 객체로 주입한다.

```ts
interface AnimationFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(requestId: number): void;
}
```

이 추상화는 scheduler 동작을 독립적으로 테스트해야 할 때만 필요하다.

실제 앱에서는 단위 테스트와 별도로 고정 fixture와 같은 스크롤 입력을 사용해 변경 전후를 비교해야 한다. 측정 조건, 결과, 결론의 범위는 [판단 과정 글](/posts/timeline-performance-region-index-decision)에 정리했다.

## [sort1] 11. 마치며

Region 시간 인덱스는 목록 변경 시 정렬과 보조 데이터 생성을 수행하고, 스크롤 중에는 화면과 겹칠 후보만 검사한다. Canvas 갱신 신호는 스크롤 알림을 React prop 변경과 분리하고 최신 draw 함수를 호출한다.

두 구현 모두 비용을 없애지 않는다. 시간 인덱스는 재생성 비용과 추가 메모리를 사용한다. 신호 객체는 구독 등록·해제와 최신 draw 함수 관리가 필요하다.

> 성능 구현은 비용을 없애는 일보다 데이터 규모와 실행 빈도에 맞는 시점과 경로로 비용을 옮기는 일에 가깝다.

## 참고

- [React 공식 문서: `memo`](https://react.dev/reference/react/memo)
