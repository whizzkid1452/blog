---
title: '[Part 3.] Automation은 점을 연결하는 기능이 아니었다'
description: 'DAW Automation에서 시간순 Point 정렬, 오버슈트 없는 곡선 보간, Write 상태 관리, Guard Point와 Point Thinning을 하나의 모델로 구성한 과정을 공유해요.'
date: '2025-12-24'
publishedAt: '2025-12-24T12:00:00+09:00'
tags: ['daw', 'audio', 'typescript', 'automation', 'algorithm']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 3
draft: false
visibility: public
---

DAW에서 Automation은 시간에 따라 Volume이나 Pan 같은 파라미터 값을 자동으로 바꾸는 기능이에요. 화면만 보면 그저 점 몇 개 찍고 선으로 이어 놓은 것처럼 보이죠.

저도 처음에는 `time`과 `value` 배열만 있으면 충분할 줄 알았어요. 그런데 막상 엔진 레벨로 내려가 보니 세 가지 문제가 한꺼번에 쏟아지더라고요.

- 현재 재생 시간의 파라미터 값을 아주 빠르게 찾아야 해요.
- 두 점 사이를 부드럽게 이으면서도 허용 범위를 넘지 않도록 보간해야 해요.
- 사용자가 재생 중에 파라미터를 움직일 때 기존 곡선과 새 입력의 우선순위를 정해야 해요.

여기에 Point 편집, TOUCH와 LATCH 같은 Write 모드, 촘촘하게 기록된 Point 정리까지 붙고 나니 꽤 묵직한 상태 모델이 됐어요.

이 글에서는 특정 시간의 파라미터 값을 **Automation Point**, 재생 중 사용자 입력을 곡선에 기록하는 구간을 **Write Pass**라고 부를게요.

## [sort1] 1. Point를 항상 시간순으로 유지한 이유

재생 중에는 현재 시간의 왼쪽 Point와 오른쪽 Point를 계속 찾아야 해요. Point가 정렬되어 있지 않으면 매 조회마다 전체 목록을 정렬하거나 처음부터 훑어야 하니 부담이 커져요.

그래서 **추가하거나 시간을 바꿀 때 정렬 비용을 미리 치르는 방식**을 택했어요.

```ts
interface AutomationPoint {
  id: string;
  time: number;
  value: number;
  interpolation: InterpolationType;
}

function insertSorted(points: AutomationPoint[], point: AutomationPoint): void {
  const index = points.findIndex(candidate => candidate.time > point.time);

  if (index === -1) {
    points.push(point);
    return;
  }

  points.splice(index, 0, point);
}
```

편집은 사용자가 조작할 때만 일어나지만, `getValueAt()` 조회는 재생 중 매 순간 반복되니까요. Point의 시간이 바뀌면 배열에서 뺀 뒤 새 위치에 다시 넣고, 값만 바뀌면 순서가 변하지 않으니 제자리에서 갱신해요.

## [sort1] 2. 보간 방식은 시작 Point의 정책으로 뒀어요

두 Point 사이의 값은 앞선 시작 Point의 `interpolation` 정책이 결정해요.

| 보간 방식       | 어떻게 변할까요?                                  |
| --------------- | ------------------------------------------------- |
| **Hold**        | 다음 Point 전까지 이전 값을 유지해요.             |
| **Linear**      | 시간 비율에 따라 직선으로 일정하게 변해요.        |
| **Exponential** | 양수 구간에서 비율을 기하급수적으로 변화시켜요.   |
| **Logarithmic** | 초반 변화가 크고 후반 변화가 작아요.              |
| **Curved**      | 주변 Point까지 고려한 제한된 3차 곡선을 사용해요. |

기본 보간은 두 Point만 있으면 간단히 계산할 수 있어요.

```ts
function interpolateLinear(start: AutomationPoint, end: AutomationPoint, time: number): number {
  const ratio = (time - start.time) / (end.time - start.time);
  return start.value + ratio * (end.value - start.value);
}
```

다만 **Exponential 보간**은 값이 0이거나 두 점의 부호가 다르면 단순한 기하 보간을 쓸 수 없어요. 현재 구현은 두 값이 모두 충분히 큰 양수일 때만 기하 보간을 쓰고, 나머지는 완만하게 시작하는 2차 곡선으로 대체해요.

이 대체 경로는 수학적 오류는 피해 가지만, 파라미터 성격에 따라 어색할 수 있어요. Gain, Frequency, 양극성(-1 ~ 1) Pan이 모두 같은 보간 정책을 공유하기는 어렵거든요. 장기적으로는 파라미터 명세(Descriptor)가 허용 범위와 보간 정책을 함께 들고 있는 구조가 더 맞아요.

## [sort1] 3. 부드러운 곡선보다 값의 범위를 지키는 곡선이 중요했어요

일반 3차 스플라인(Cubic Spline)은 Point를 부드럽게 통과하지만, Point 사이에서 최솟값보다 작아지거나 최댓값보다 커지는 오버슈트(Overshoot)가 생길 수 있어요. 그래프가 살짝 튀는 정도로 끝나면 다행인데, 오디오에서는 Volume이 의도보다 커지거나 0~1 범위의 파라미터가 범위를 벗어나 버리는 문제로 이어지거든요.

Cubic Hermite 보간에서는 각 구간의 양 끝 값과 접선으로 곡선을 정해요. [SciPy의 CubicHermiteSpline 문서](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.CubicHermiteSpline.html)

그래서 Curved 보간에서는 인접 구간의 기울기를 계산한 뒤 접선의 부호와 크기를 엄격하게 제한했어요.

```mermaid
flowchart LR
  A["정렬된 Point"] --> B["구간 기울기 계산"]
  B --> C["접선 방향 제한"]
  C --> D["접선 크기 제한"]
  D --> E["Cubic Hermite 계수"]
  E --> F["현재 시간의 값 평가"]
```

가장 부드러운 곡선보다, **Point가 표현한 증가와 감소 방향을 뒤집지 않는 안전한 곡선**을 선택한 거예요.

## [sort1] 4. 순차 조회에는 Segment Cache를 썼어요

Point가 정렬되어 있으니 현재 시간이 속한 구간은 이진 탐색으로 찾을 수 있어요. 다만 재생 시간은 대부분 앞으로 조금씩 이동하기 때문에 직전에 조회한 구간을 다시 조회할 가능성이 압도적으로 높아요.

현재 구간의 왼쪽과 오른쪽 인덱스를 캐싱해 두면 같은 구간에서는 이진 탐색조차 건너뛸 수 있어요.

```ts
interface LookupCache {
  left: number;
  leftIndex: number;
  rightIndex: number;
}

function isCacheHit(cache: LookupCache, points: AutomationPoint[], time: number): boolean {
  return time >= cache.left && time < points[cache.rightIndex].time;
}
```

물론 Point를 추가하거나 이동하거나 삭제하면 인덱스와 구간이 바뀌기 때문에 Lookup Cache와 Spline 계수 캐시를 함께 무효화해야 해요.

캐시의 정확성은 빠른 조회가 아니라, **무효화 조건을 먼저 정의하는 데서** 시작해요.

현재 구현은 Point 변경 메서드에서 캐시를 무효화해요. 다만 외부로 반환한 Point 객체의 속성을 직접 바꾸면 이 경로를 우회할 수 있다는 빈틈이 있어요. `ReadonlyArray`는 배열 조작만 막아 줄 뿐 내부 객체 변경까지 막는 Deep Readonly는 아니거든요. Point를 불변 객체로 반환하거나 모든 변경을 메서드로 제한하는 쪽이 더 안전해요.

## [sort1] 5. Write Mode는 입력 우선순위 정책이었어요

Automation Mode는 **지금 값을 기존 곡선에서 가져올지, 사용자 입력에서 가져올지** 결정하는 우선순위 정책이에요.

| Mode  | 기존 곡선 재생                   | 사용자 입력 기록                 |
| ----- | -------------------------------- | -------------------------------- |
| READ  | 항상 사용해요                    | 기록하지 않아요                  |
| WRITE | 사용하지 않아요                  | 항상 기록해요                    |
| TOUCH | 손을 떼면 기존 곡선으로 돌아가요 | 만지는 동안만 기록해요           |
| LATCH | 손을 뗀 뒤 마지막 값을 유지해요  | 보통 재생이 끝날 때까지 기록해요 |
| OFF   | 사용하지 않아요                  | 기록하지 않아요                  |

현재 코드는 TOUCH와 LATCH 모두 `touching`이 `true`일 때만 기록하고, `stopTouch()`에서 Write Pass를 종료해요. 표에 정리한 일반적인 LATCH 동작과 현재 구현이 아직 일치하지 않아요.

정확한 LATCH를 구현하려면 별도의 상태 모델이 필요해요.

```ts
type WriteState =
  { type: 'idle' } | { type: 'touching'; startedAt: number } | { type: 'latched'; startedAt: number; value: number };
```

손을 뗐다는 입력과 재생이 끝났다는 입력을 구분해야 `latched` 상태를 유지할 수 있어요. enum 이름만 나눠 놓는다고 해결되는 문제는 아니었어요.

## [sort1] 6. Guard Point와 Point Thinning을 함께 고려했어요

재생 중 노브를 움직이면 짧은 시간에도 많은 Point가 쌓여요. 이걸 그대로 두면 조회와 편집 비용이 커지고, 화면에도 거의 같은 곡선에 점이 빽빽하게 찍혀요.

**Point Thinning**은 인접한 세 Point가 만드는 삼각형 면적을 계산해서, 가운데 Point의 면적이 기준치(Threshold)보다 작으면 곡선에 미치는 영향이 작다고 보고 제거하는 방식이에요. 첫 Point와 마지막 Point는 항상 유지해요.

```ts
function triangleArea(a: AutomationPoint, b: AutomationPoint, c: AutomationPoint): number {
  return Math.abs((a.time * (b.value - c.value) + b.time * (c.value - a.value) + c.time * (a.value - b.value)) / 2);
}
```

Write 구간 안의 Point만 정리하면 구간 바깥의 기존 곡선까지 달라질 수 있어요. 그래서 Write 경계 직전과 직후의 기존 값을 **Guard Point**로 추가해 바깥 구간의 형태를 보존했어요.

여기에도 한계가 있어요. 시간과 값의 단위 비율이 달라지면 같은 면적 기준치의 의미도 바뀌거든요. 0~~1 범위의 Volume과 20~~20,000Hz 범위의 Frequency에 같은 기준치를 쓰면 정리 강도가 달라져요. 파라미터 범위를 정규화한 뒤 면적을 계산하는 방식이 필요해요.

## [sort1] 7. 현재 검증 범위와 필요한 테스트

Automation List는 Processor와 AudioEngine의 파라미터 바인딩 경로에 연결되어 있지만, 자동 테스트는 아직 없어요. 아래 항목들을 검증하기 전에는 완전한 동작을 보장하기 어려워요.

- Point 추가하거나 이동한 뒤에도 시간순 정렬이 깨지지 않는지
- Hold, Linear, Exponential, Logarithmic 경계값
- Curved 구간에서 값이 양 끝 Point의 범위를 벗어나지 않는지
- Point 변경 후 Lookup Cache와 Spline Cache가 무효화되는지
- TOUCH가 손을 뗀 뒤 기존 곡선으로 돌아오는지
- LATCH가 재생 종료까지 마지막 값을 유지하는지
- Thinning 전후 최대 오차가 허용 범위 안에 있는지

특히 곡선 테스트는 모양이 자연스러운지가 아니라 **불변 조건**으로 작성해야 해요.

```ts
expect(value).toBeGreaterThanOrEqual(Math.min(start.value, end.value));
expect(value).toBeLessThanOrEqual(Math.max(start.value, end.value));
```

## [sort1] 8. 마치며

Automation을 구현하며 가장 크게 배운 점은 **시간에 따른 값을 계산하는 문제**와 **지금 누가 그 값을 소유하는지 결정하는 문제**를 분리해서 다뤄야 한다는 점이었어요. 초반에는 3차 스플라인 수식과 오버슈트를 막는 접선 제한에 가장 많은 시간을 쏟았지만, 막상 Write 모드와 캐시, Point Thinning까지 한 모델에 얹고 나니 실제 재생 값을 좌우하는 건 Point 편집, 캐시 무효화, 사용자 터치 상태가 맞물린 우선순위 규칙이었거든요.

현재 구조는 정렬된 Point, 오버슈트를 막는 Curved 보간, Guard Point와 Thinning의 기반을 갖추고 있어요. 이제 TOUCH와 LATCH를 명시적 상태로 분리하고, 곡선 범위와 캐시 무효화를 자동 테스트로 고정하는 작업이 남아 있어요.

지금까지 엔진 내부에서 시간과 신호, 파라미터 곡선을 다루는 모델을 살펴봤다면, 다음 글에서는 외부 세계와 데이터를 주고받는 첫 번째 경계인 **Standard MIDI File** 파싱과 직렬화 이야기로 넘어가 볼게요.

## 참고

- [SciPy, CubicHermiteSpline](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.CubicHermiteSpline.html)
- [Web Audio API 1.1, AudioParam automation](https://www.w3.org/TR/webaudio-1.1/)
- [F. N. Fritsch and R. E. Carlson, Monotone Piecewise Cubic Interpolation](https://doi.org/10.1137/0717021)
- [믹싱 오토메이션 완전 가이드](https://studionol.co.kr/ko/stories/mix-automation1)
- [Creative Mix Automation In Your DAW](https://www.soundonsound.com/techniques/creative-mix-automation-your-daw)
