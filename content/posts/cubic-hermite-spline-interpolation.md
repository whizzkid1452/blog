---
title: 'Cubic Hermite Spline이란? 값과 접선으로 만드는 3차 보간'
description: 'Cubic Hermite 보간식과 연속성 조건, 접선 선택에 따른 Overshoot를 살펴보고 DAW Automation Curve에 적용한 방법을 설명합니다.'
date: '2026-08-03'
tags: ['algorithm', 'math', 'typescript', 'audio', 'automation']
draft: false
visibility: public
---

DAW의 Automation Curve를 구현하면서 Cubic Hermite 보간을 공부하게 되었다.

Automation은 특정 시간의 Parameter 값을 Point로 저장한다. 하지만 재생 중에는 Point에 저장된 값만 사용할 수 없다. 두 Point 사이의 모든 시점에 해당하는 값도 계산해야 한다.

Linear 보간은 계산이 단순하고 결과를 예측하기 쉽다. 하지만 Point에서 기울기가 갑자기 변한다. 일반적인 Cubic Spline은 곡선을 더 부드럽게 만들지만, Point 사이에서 입력값의 범위를 벗어나는 Overshoot가 발생할 수 있다.

내가 필요했던 것은 단순히 부드러운 곡선이 아니었다.

- Automation Point를 정확히 통과해야 한다.
- Point 사이의 기울기가 자연스럽게 이어져야 한다.
- 단조 구간에서는 불필요한 Overshoot를 억제해야 한다.

이 조건을 구현하는 과정에서 Cubic Hermite와 접선 제한 방법을 함께 공부하게 되었다.

## [sort1] 1. 보간은 Point 사이의 값을 계산한다

보간(Interpolation)은 주어진 Data Point를 이용해 Point 사이의 값을 계산하는 방법이다.

다음 두 Point가 있다고 가정하자.

```text
(0, 2), (1, 6)
```

두 Point 사이의 `x = 0.5`에서 값을 계산하는 가장 단순한 방법은 Linear 보간이다.

```text
y = 2 + 0.5 * (6 - 2)
  = 4
```

Linear 보간은 두 Point를 직선으로 연결한다. 계산 결과가 두 값 사이에 머무르지만 여러 구간을 연결하면 접점에서 기울기가 끊길 수 있다.

Automation Curve에서도 같은 현상이 나타난다. Point의 값은 연속적이지만 기울기가 갑자기 바뀌면 Parameter 변화도 같은 형태로 꺾인다. 더 자연스러운 변화를 만들려면 값뿐 아니라 Point를 통과하는 방향도 함께 고려해야 한다.

## [sort1] 2. Cubic Hermite는 끝점과 접선으로 한 구간을 정의한다

Cubic Hermite Curve는 두 Point 사이의 단일 구간이다. Cubic Hermite Spline은 여러 Cubic Hermite Curve를 이어 만든 전체 곡선이다.

```text
P0 ─── P1 ─── P2 ─── P3
   구간 0  구간 1  구간 2
```

각 구간은 다음 네 가지 조건으로 결정된다.

- 시작 값 `P0`
- 끝 값 `P1`
- 시작 접선 `M0`
- 끝 접선 `M1`

접선은 해당 Point에서 값이 어느 방향으로 얼마나 빠르게 변하는지를 나타낸다.

Automation에서는 각 Point가 시간과 Parameter 값을 가진다. Cubic Hermite는 이 값에 접선 조건을 추가해 Point 사이의 변화를 계산한다.

## [sort1] 3. 네 개의 Hermite Basis가 값과 접선의 영향을 나눈다

구간 안의 위치를 `0`부터 `1` 사이의 값 `t`로 나타내면 Cubic Hermite 보간식은 다음과 같다.

```text
P(t) = H00(t) * P0
     + H10(t) * M0
     + H01(t) * P1
     + H11(t) * M1
```

각 Hermite Basis Function은 다음과 같다.

```text
H00(t) =  2t³ - 3t² + 1
H10(t) =   t³ - 2t² + t
H01(t) = -2t³ + 3t²
H11(t) =   t³ - t²
```

각 Basis는 하나의 조건을 담당한다.

- `H00`: 시작 값의 영향
- `H10`: 시작 접선의 영향
- `H01`: 끝 값의 영향
- `H11`: 끝 접선의 영향

`t = 0`을 대입하면 결과는 `P0`이 된다. `t = 1`을 대입하면 결과는 `P1`이 된다. 따라서 곡선은 두 Automation Point를 정확히 통과한다.

## [sort1] 4. 시간 간격이 다르면 접선에 구간 길이를 반영해야 한다

Automation Point의 시간 간격은 항상 같지 않다.

시작 시간을 `x0`, 끝 시간을 `x1`이라고 하면 구간 길이는 다음과 같다.

```text
h = x1 - x0
```

현재 시간 `x`는 구간 내부의 값으로 정규화한다.

```text
t = (x - x0) / h
```

접선 `m0`, `m1`이 시간에 대한 변화율이라면 Hermite 보간식에 구간 길이를 반영해야 한다.

```text
P(t) = H00(t) * P0
     + H10(t) * h * m0
     + H01(t) * P1
     + H11(t) * h * m1
```

이 보정을 생략하면 같은 접선 값을 사용해도 Point의 시간 간격에 따라 곡선의 형태가 달라진다.

프로젝트에서는 각 Automation 구간의 실제 시간 차이를 `h`로 사용했다. Point 간격이 달라도 시간축에 맞는 다항식 계수를 계산하기 위해서다.

다음 함수로 단일 구간의 값을 확인할 수 있다.

```ts
interface CubicHermiteSegment {
  startValue: number;
  endValue: number;
  startSlope: number;
  endSlope: number;
  duration: number;
}

function interpolateCubicHermite(segment: CubicHermiteSegment, elapsedTime: number): number {
  const normalizedTime = Math.min(Math.max(elapsedTime / segment.duration, 0), 1);
  const squaredTime = normalizedTime * normalizedTime;
  const cubedTime = squaredTime * normalizedTime;

  const startValueBasis = 2 * cubedTime - 3 * squaredTime + 1;
  const startSlopeBasis = cubedTime - 2 * squaredTime + normalizedTime;
  const endValueBasis = -2 * cubedTime + 3 * squaredTime;
  const endSlopeBasis = cubedTime - squaredTime;

  return (
    startValueBasis * segment.startValue +
    startSlopeBasis * segment.duration * segment.startSlope +
    endValueBasis * segment.endValue +
    endSlopeBasis * segment.duration * segment.endSlope
  );
}
```

## [sort1] 5. 접선 공유는 C1 연속성을 만든다

Spline을 구성하려면 각 구간의 경계가 자연스럽게 이어져야 한다.

앞 구간의 끝점과 다음 구간의 시작점이 같으면 값이 끊기지 않는다. 이를 `C0` 연속성이라고 한다.

```text
Pi(1) = Pi+1(0)
```

연결점의 값뿐 아니라 1차 미분값도 같으면 기울기가 끊기지 않는다. 이를 `C1` 연속성이라고 한다.

```text
Pi'(1) = Pi+1'(0)
```

프로젝트에서는 하나의 Automation Point에 계산된 접선을 왼쪽 구간의 끝 접선과 오른쪽 구간의 시작 접선으로 함께 사용했다. 따라서 연결점에서 같은 1차 미분값을 공유한다.

`C2` 연속성을 만족하려면 연결점의 2차 미분값도 같아야 한다.

```text
Pi''(1) = Pi+1''(0)
```

접선의 방향과 크기만 같다고 해서 `C2` 연속성이 자동으로 보장되는 것은 아니다. 현재 프로젝트의 Cubic Hermite Curve는 `C1` 연속성을 구성하지만 `C2` 연속성을 보장하지는 않는다.

이 구분을 통해 “부드럽다”는 표현도 어떤 미분 차수까지 연속인지 나눠 설명해야 한다는 점을 알게 되었다.

## [sort1] 6. Cubic Hermite 자체는 접선을 결정하지 않는다

Cubic Hermite 보간식은 접선 값을 자동으로 결정하지 않는다. 같은 Point를 사용해도 접선을 어떻게 선택하느냐에 따라 곡선의 형태가 달라진다.

사용자가 접선을 직접 지정할 수도 있고 주변 Point를 이용해 계산할 수도 있다.

Uniform Catmull–Rom Spline은 내부 Point의 접선을 다음과 같이 계산한다.

```text
Mi = (Pi+1 - Pi-1) / 2
```

즉, 이전 Point에서 다음 Point로 향하는 Vector의 절반을 현재 Point의 접선으로 사용한다. Catmull–Rom은 별개의 3차 다항식이라기보다 주변 Point로 Cubic Hermite의 접선을 정하는 한 가지 방법으로 볼 수 있다.

하지만 Automation에서는 자연스러워 보이는 접선만으로 충분하지 않았다. 접선이 너무 크면 Point 사이에서 값이 두 끝점의 범위를 벗어나는 Overshoot가 발생할 수 있기 때문이다.

## [sort1] 7. 단조 구간을 지키려면 접선을 제한해야 한다

먼저 인접 Point 사이의 할선 기울기(Secant Slope)를 계산한다.

```text
delta[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i])
```

현재 Point의 왼쪽 기울기와 오른쪽 기울기의 부호가 다르면 증가와 감소가 전환되는 지점이다.

```ts
if (delta[index - 1] * delta[index] <= 0) {
  tangent[index] = 0;
}
```

이때 접선을 0으로 설정하면 곡선이 극값을 지나 같은 방향으로 계속 진행하는 현상을 억제할 수 있다.

양쪽 기울기의 부호가 같으면 조화평균으로 접선을 계산할 수 있다.

```text
m[i] = 2 / (1 / delta[i - 1] + 1 / delta[i])
```

조화평균은 두 기울기 중 작은 값의 영향을 더 크게 받는다. 이 방식은 Kruger가 제시한 내부 Point 접선 계산과 일치한다. [Kruger의 Constrained Cubic Spline](https://www.deriscope.com/docs/Kruger_CubicSpline.pdf)

프로젝트에서는 조화평균을 적용한 뒤 접선의 크기도 한 번 더 제한했다.

```text
alpha = m[i] / delta[i]
beta  = m[i + 1] / delta[i]
```

`sqrt(alpha² + beta²) > 3`이면 두 접선의 비율을 유지한 채 크기를 줄인다. 이는 Fritsch–Carlson 방식에서 사용하는 단조성 제한과 같은 형태다. [Fritsch–Carlson 논문](https://doi.org/10.1137/0717021)

현재 구현은 순수한 Kruger 알고리즘이라고 부르기 어렵다.

- 내부 접선은 Kruger의 조화평균 방식을 사용한다.
- 경계 접선은 한쪽 구간의 할선 기울기를 사용한다.
- 이후 Fritsch–Carlson 형태의 크기 제한을 적용한다.

따라서 **Kruger의 내부 접선 계산과 Fritsch–Carlson 형태의 제한을 조합한 Cubic Hermite 보간**이라고 표현하는 것이 정확하다.

## [sort1] 8. Power Basis로 변환하면 계수를 재사용할 수 있다

각 Cubic Hermite 구간은 다음 Power Basis로 변환할 수 있다.

```text
P(x) = a + bx + cx² + dx³

a = y0
b = m0
c = (3 * (y1 - y0) / h - 2 * m0 - m1) / h
d = (2 * (y0 - y1) / h + m0 + m1) / h²
```

여기서 `x`는 구간 시작 시간으로부터의 상대 시간이다.

프로젝트의 `AutomationCurve`는 각 구간의 `a`, `b`, `c`, `d`를 미리 계산해 저장한다. 값을 조회할 때는 현재 시간이 포함된 구간을 찾은 뒤 다음 식만 계산한다.

```ts
const value =
  coefficient.a +
  coefficient.b * elapsedTime +
  coefficient.c * elapsedTime * elapsedTime +
  coefficient.d * elapsedTime * elapsedTime * elapsedTime;
```

Automation Point가 추가되거나 이동하면 기존 계수는 더 이상 유효하지 않다. `AutomationList`는 Point 변경 시 저장된 계수를 무효화하고 다음 조회에서 다시 계산하도록 구성했다.

이 과정에서 보간 공식뿐 아니라 **계산 결과의 유효 조건과 Cache 무효화 시점도 함께 설계해야 한다**는 점을 알게 되었다.

## [sort1] 9. Cubic Hermite와 Cubic Bézier는 서로 변환할 수 있다

Cubic Hermite Curve와 Cubic Bézier Curve는 모두 3차 다항식이다. 사용하는 정보가 다를 뿐 서로 변환할 수 있다.

Hermite는 두 끝점과 두 접선을 사용한다. Bézier는 두 끝점과 두 Control Point를 사용한다.

정규화된 구간에서 Hermite 접선을 Bézier Control Point로 변환하면 다음과 같다.

```text
B0 = P0
B1 = P0 + M0 / 3
B2 = P1 - M1 / 3
B3 = P1
```

접선이 실제 시간축에 대한 미분값이라면 구간 길이를 반영해야 한다. [Cubic Hermite와 Bézier 변환](https://lee-seokhyun.gitbook.io/game-programming/client/easy-mathematics/gdc2012/3-cubic-hermite-splines)

두 곡선의 관계를 이해하면서 Cubic Hermite가 완전히 다른 곡선이 아니라, 같은 3차 다항식을 값과 접선 중심으로 표현한 방식이라는 점을 알게 되었다.

## [sort1] 10. Automation에서는 부드러움과 범위 보존을 함께 판단해야 한다

Linear, Cubic Hermite, Bézier, Catmull–Rom은 곡선을 정의하거나 접선을 선택하는 기준이 다르다. Cubic Hermite라는 형식만으로 Overshoot가 방지되는 것은 아니다.

프로젝트에서 필요했던 것은 일반적인 Cubic Hermite보다 Monotone Cubic Hermite에 가까웠다. Automation Point를 통과하는 것만큼 Point 사이의 값이 의도한 범위를 유지하는 것도 중요했기 때문이다.

프로젝트에서 전체 Automation 상태와 Curve Cache를 어떻게 구성했는지는 [[Part 3.] Automation은 점을 연결하는 기능이 아니었다](/posts/daw-engine-automation-curve)에서 더 자세히 다룬다.

> “Cubic Hermite의 핵심은 Point 사이를 부드럽게 연결하는 데 그치지 않는다. 각 Point를 어떤 방향으로 통과할지 정의하면서도 접선을 제한해 Data의 의미를 보존하는 데 있다.”

## 참고

- [3차 허밋 스플라인(Cubic Hermite Splines)](https://lee-seokhyun.gitbook.io/game-programming/client/easy-mathematics/gdc2012/3-cubic-hermite-splines)
- [C. J. C. Kruger, Constrained Cubic Spline Interpolation](https://www.deriscope.com/docs/Kruger_CubicSpline.pdf)
- [F. N. Fritsch and R. E. Carlson, Monotone Piecewise Cubic Interpolation](https://doi.org/10.1137/0717021)
