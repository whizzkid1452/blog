---
title: '오디오 파형 로딩 지연 해결기: 동적 stride를 이용한 Peak 연산 최적화'
description: '긴 오디오 파일에서 파형 Peak 추출이 메인 스레드를 점유하던 문제를 동적 stride 방식으로 줄인 과정을 정리합니다.'
date: '2026-02-04'
publishedAt: '2026-02-04T10:50:41+09:00'
tags: ['audio', 'peak', 'stride', '최적화']
draft: false
---

## 들어가며

오디오 트림 에디터 개발하면서 진짜 골치 아픈 문제를 만났다. 짧은 음원에서는 지연을 느끼지 못하다가, 컴퓨터 성능이 좋지않거나 15분 이상의 긴 길이의 오디오 파일을 불러오면 화면이 멈춘 것처럼 보이고, 사용자는 그냥 기다릴 수밖에 없었다. 파형이 그려지기까지 몇 초씩 걸리는 이 문제를 어떻게 해결했는지 공유한다.

---

## 1. 문제 발견: "왜 이렇게 느리지?"

### 1-1. 증상

처음엔 그냥 "파일이 커서 그런가보다" 하고 넘어갔다. 근데 사용자 테스트 해보니까 문제가 심각하더라.

- **1분 오디오**: 느린것을 못느낌, 즉각적으로 화면 업데이트됨.
- **5분 오디오**: 음... 좀 기다려야 하네
- **15분 이상 오디오**: 화면이 멈췄나? 브라우저가 죽은 건가?

특히 문제는 **긴 길이의 오디오 파일을 업로드**할 때였다. 물론 프로덕트 특성 상, 5분 이내의 짧은 파일을 업로드하는 경우가 대부분이겠지만, **참된 개발자라면 언제나 엣지케이스를 고려**해야한다.

### 1-2. 첫 번째 가설: "디코딩이 느린가?"

처음엔 당연히 decodeAudioData가 범인일 거라 생각했다. 큰 파일 디코딩하는 게 오래 걸리는 거 당연하지 않나? "웹 오디오 API 자체가 느린 거면 어떡하지..." 걱정이 앞섰다.

---

## 2. 원인 추적: 범인을 찾아서

### 2-1. 측정의 시작

막연한 추측으로는 문제를 해결할 수 없었다. 정확히 **어디서** 시간이 걸리는지 알아야 했다. 가장 먼저 한 건 console.time으로 각 구간 측정하는 거였다.

```ts
console.time('decodeAudioData');
const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
console.timeEnd('decodeAudioData');

console.time('extractPeaks');
peaks = extractPeaks(decodedBuffer);
console.timeEnd('extractPeaks');

console.time('drawWaveform');
drawWaveform();
console.timeEnd('drawWaveform');
```

\- ctx.decodeAudioData(): Web Audio API 메서드. arrayBuffer(원본 오디오 데이터)를 AudioBuffer 객체로 디코딩

\- arrayBuffer: 인코딩된 오디오 파일의 raw 데이터

### 2-2. 충격적인 결과

```text
decodeAudioData: 800ms
extractPeaks: 2100ms ← 🚨
drawWaveform: 30ms
```

**"뭐야, 범인은 extractPeaks였네!"**

디코딩은 1초도 안 걸렸는데, peak 추출하는 데 2초 넘게 걸렸다. 완전 예상 밖이었다.

### 2-3. Chrome DevTools로 더 깊이

정확히 extractPeaks 내부에서 무슨 일이 일어나는지 보려고 Chrome DevTools Performance 탭을 열었다.

**Record → 파일 로딩 → Stop**

결과를 보니까 메인 스레드에 **거대한 노란색 블록**이 하나 있더라. 클릭해보니까 extractPeaks 함수 내부의 for 루프였다.

"아... 이 반복문이 메인 스레드를 완전히 잡아먹고 있구나."

---

## 3. 근본 원인 파악: 수백만 번의 반복

### 3-1. 코드 뜯어보기

문제의 코드를 다시 자세히 들여다봤다.

```ts
function extractPeaks(audioBuffer: AudioBuffer, barCount = 1500) {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const samplesPerBar = Math.floor(totalSamples / barCount);

  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = start + samplesPerBar;
    let max = 0;

    // 🚨 문제의 구간
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j] ?? 0);
      if (val > max) max = val;
    }

    peaks.push(max);
  }

  return peaks;
}
```

\- barCount = 1500: 두 번째 매개변수. 기본값(default parameter)이 1500. 인자를 안 넘기면 1500 사용

\- audioBuffer.getChannelData(0): AudioBuffer에서 0번 채널(왼쪽 채널, 모노는 유일한 채널)의 샘플 데이터를 Float32Array로 반환

\- i \* samplesPerBar: 현재 바의 시작 인덱스 계산

### 3-2. 숫자로 계산해보기

5분 오디오를 기준으로 계산해봤다:

- **샘플레이트**: 44.1kHz
- **길이**: 5분 = 300초
- **총 샘플 수**: 44,100 × 300 = **13,230,000개**
- **바 개수**: 1,500개
- **바당 샘플 수**: 13,230,000 ÷ 1,500 = **8,820개**

즉, 내부 for 루프는 **8,820번 × 1,500번 = 13,230,000번** 실행된다.

**"천만 번이 넘는 반복문을... JavaScript 메인 스레드에서..."**

이제 왜 느린지 명확했다.

### 3-3. "정말 모든 샘플을 봐야 할까?"

여기서 핵심적인 질문을 던졌다.

> "파형 시각화를 위해 정말 모든 샘플을 확인해야 할까?"

곰곰이 생각해보니까:

1.  **오디오는 연속 신호**다. 인접한 샘플끼리는 값이 크게 차이나지 않는다.
2.  우리가 찾는 건 **구간의 최대값(peak)**이다. 정확한 평균이 아니다.
3.  사용자 눈에는 **픽셀 단위**로만 보인다. 1픽셀에 수천 개의 샘플이 압축되는데, 그걸 전부 볼 필요가 있을까?

"전부 볼 필요는 없겠다!"는 확신이 들었다.

---

## 4. 해결책 탐색: 다른 사람들은 어떻게 했을까?

### 4-1. 레퍼런스 찾기

혼자 고민하기보다 비슷한 문제를 해결한 사례를 찾아봤다.

**① webaudio-peaks 라이브러리**

```text
// samplesPerPixel로 구간당 샘플 수 제한
extractPeaks(audioBuffer, { samplesPerPixel: 1000 })
```

이 라이브러리는 **픽셀당 샘플 수를 제한**하는 방식으로 최적화했다. "아, 모든 샘플을 보지 않아도 되는구나!"

**② Wavesurfer.js의 접근**

```ts
// 10개씩 묶어서 평균 계산
const averaged = peaks.reduce((acc, val, i) => {
  if (i % 10 === 0) acc.push(val);
  return acc;
}, []);
```

Wavesurfer는 sampleSize=10으로 peak를 10개씩 묶어서 평균을 냈다. 이것도 일종의 다운샘플링이었다.

**③ BBC audiowaveform**

BBC의 도구는 아예 -pixels-per-second 1 옵션으로 **초당 1픽셀**까지 해상도를 줄였다. 그래도 시각적으로는 충분했다.

### 4-2. Stride 개념 발견

이런 사례들을 보면서

> **stride(보폭)**

이라는 개념을 알게 됐다.

딥러닝의 convolution에서 쓰이는 용어인데,

> "필터를 몇 칸씩 이동할 것인가"

를 의미한다.

```ts
// stride 1: 한 칸씩
for (let j = start; j < end; j += 1) { ... }

// stride 10: 열 칸씩
for (let j = start; j < end; j += 10) { ... }
```

**"그래, 우리도 stride를 적용하자!"**

---

## 5. 해결책 구현: 고정 Stride 10에서 동적 Stride로

### 5-0. 공통 구조: 하나의 함수, 세 가지 방식

테스트 구현에서는 세 가지 방식 모두 같은 함수 runExtractPeaksWithStride를 사용했고, stride 값만 다르게 전달했다.

```ts
function runExtractPeaksWithStride(channelData, totalBars, step, strideMode) {
  const peaks = [];
  let totalIterations = 0;

  for (let i = 0; i < totalBars; i++) {
    const start = i * step;
    const end = start + step;
    let max = 0;

    // 핵심: strideMode에 따라 stride 계산
    const stride =
      strideMode === 'dynamic'
        ? Math.max(1, Math.floor(step / 20)) // 동적
        : strideMode; // 1 또는 10

    for (let j = start; j < end; j += stride) {
      const val = Math.abs(channelData[j] ?? 0);
      if (val > max) max = val;
      totalIterations += 1;
    }

    peaks.push(max);
  }

  return { peaks, totalIterations };
}
```

**세 가지 호출 방식:**

```text
// 1. j++ (stride 1)
runExtractPeaksWithStride(channelData, totalBars, step, 1)
// → stride = 1
// → j += 1 (모든 샘플 순회)

// 2. j+=10 (stride 10)
runExtractPeaksWithStride(channelData, totalBars, step, 10)
// → stride = 10
// → j += 10 (10개마다 샘플링)

// 3. 동적 stride
runExtractPeaksWithStride(channelData, totalBars, step, 'dynamic')
// → stride = Math.max(1, Math.floor(step / 20))
// → j += stride (바당 약 20회)
```

| 버전            | stride 값                          | 루프 형태   |
| --------------- | ---------------------------------- | ----------- |
| **j++**         | 1                                  | j += 1      |
| **j+=10**       | 10                                 | j += 10     |
| **동적 stride** | Math.max(1, Math.floor(step / 20)) | j += stride |

세 버전 모두 같은 runExtractPeaksWithStride 안에서 strideMode만 1, 10, 'dynamic'으로 바꿔 쓰는 구조다.

### 5-1. 첫 번째 시도: 고정 Stride 10

처음엔 단순하게 stride를 10으로 고정했다.

```ts
// stride 10으로 호출
const result = runExtractPeaksWithStride(channelData, totalBars, step, 10);
```

내부적으로는:

```ts
const stride = 10; // strideMode가 10이므로
for (let j = start; j < end; j += 10) {
  const val = Math.abs(channelData[j] ?? 0);
  if (val > max) max = val;
}
```

단 한 글자 차이다. j++(stride 1)를 j += 10(stride 10)으로 바꿨을 뿐이다. 결과는 좋았다. 5분 오디오에서 2100ms → 210ms로 10배 빨라졌다.

### 5-2. 문제 발견: "오디오가 길어지면?"

하지만 더 긴 오디오로 테스트하면서 한계를 발견했다.

**20초 오디오 (499 bars, step 1921)**

| 방식              | 소요 시간 | 총 반복 횟수 |
| ----------------- | --------- | ------------ |
| j++ (stride 1)    | 3.76ms    | 958,579      |
| j+=10 (stride 10) | 0.57ms    | 96,307       |

**284초 오디오 (7,101 bars, step 1920)**

| 방식              | 소요 시간 | 총 반복 횟수 |
| ----------------- | --------- | ------------ |
| j++ (stride 1)    | 52.75ms   | 13,633,920   |
| j+=10 (stride 10) | 5.16ms    | 1,363,392    |

**2489초 오디오 (62,225 bars, step 1920)**

| 방식              | 소요 시간 | 총 반복 횟수 |
| ----------------- | --------- | ------------ |
| j++ (stride 1)    | 197.18ms  | 119,472,000  |
| j+=10 (stride 10) | 55.80ms   | 11,947,200   |

문제가 보였다. **오디오 길이에 비례해서 처리 시간이 계속 늘어난다.**

41분짜리 파일에서는 55.80ms나 걸렸다. 이건 사용자가 "잠깐 멈췄다"고 느낄 수 있는 수준이다.

### 5-3. 핵심 통찰: "바당 일정한 샘플만 확인하면 되지 않을까?"

곰곰이 생각해봤다.

- 20초 오디오든 95분 오디오든, **각 바가 표현하는 시각적 의미는 같다**
- 한 바의 최대값(peak)을 찾는 데 굳이 수천 번씩 반복할 필요가 있을까?
- 바당 20회 정도만 샘플링해도 최대값을 충분히 찾을 수 있지 않을까?

"그래, stride를 동적으로 조절하자!"

### 5-4. 동적 Stride 구현

```ts
// 동적 stride로 호출
const result = runExtractPeaksWithStride(channelData, totalBars, step, 'dynamic');
```

내부적으로는:

```ts
// strideMode가 'dynamic'이므로
const stride = Math.max(1, Math.floor(step / 20));

for (let j = start; j < end; j += stride) {
  const val = Math.abs(channelData[j] ?? 0);
  if (val > max) max = val;
}
```

핵심은 const stride = Math.max(1, Math.floor(step / 20)); 이 한 줄이다.

- step / 20: 바를 20등분
- Math.floor(): 정수로 변환
- Math.max(1, ...): 최소값은 1 (stride가 0이 되는 것 방지)

**전체 함수 구조:**

```ts
function runExtractPeaksWithStride(channelData, totalBars, step, strideMode) {
  const peaks = [];
  let totalIterations = 0;

  for (let i = 0; i < totalBars; i++) {
    const start = i * step;
    const end = start + step;
    let max = 0;

    // strideMode에 따라 stride 결정
    const stride = strideMode === 'dynamic' ? Math.max(1, Math.floor(step / 20)) : strideMode;

    for (let j = start; j < end; j += stride) {
      const val = Math.abs(channelData[j] ?? 0);
      if (val > max) max = val;
      totalIterations += 1;
    }

    peaks.push(max);
  }

  return { peaks, totalIterations };
}
```

### 5-5. 동적 Stride의 작동 원리

**20초 오디오 예시:**

- step = 1921 (바당 샘플 수)
- stride = Math.floor(1921 / 20) = 96
- 바당 반복 횟수: 1921 ÷ 96 ≈ 20회

**95분 오디오 예시:**

- step = 16,799 (바당 샘플 수)
- stride = Math.floor(16799 / 20) = 839
- 바당 반복 횟수: 16799 ÷ 839 ≈ 20회

**핵심:** 오디오 길이와 관계없이 **바당 약 20회로 고정**된다!

---

## 6. 결과: 극적인 개선

### 6-1. 전체 비교

- test 1: 20초 오디오 (step 1921, totalBars 499)

| 방식                  | 소요 시간   | totalIterations | 비고                            |
| --------------------- | ----------- | --------------- | ------------------------------- |
| **j++ (stride 1)**    | **3.76 ms** | 958,579         | 가장 느림, 모든 샘플 순회       |
| **j+=10 (stride 10)** | **0.57 ms** | 96,307          | 이번 측정에서 가장 빠름         |
| **동적 stride**       | **0.75 ms** | 10,479          | 연산량은 가장 적음 (약 21회/바) |

- test 2: 284초 오디오 (step 1920, totalBars 7,101)

| 방식                  | 소요 시간    | totalIterations | 비고                                       |
| --------------------- | ------------ | --------------- | ------------------------------------------ |
| **j++ (stride 1)**    | **52.75 ms** | 13,633,920      | 가장 느림, 모든 샘플 순회                  |
| **j+=10 (stride 10)** | **5.16 ms**  | 1,363,392       | 고정 stride로 연산량 증가                  |
| **동적 stride**       | **1.63 ms**  | 142,020         | 이번 측정에서 가장 빠름, 바당 약 20회 유지 |

- test 3: 2489초 오디오 (≈41.5분, step 1920, totalBars 62,225)

| 방식                  | 소요 시간     | totalIterations | 비고                            |
| --------------------- | ------------- | --------------- | ------------------------------- |
| **j++ (stride 1)**    | **197.18 ms** | 119,472,000     | 약 0.2초 블로킹, 모든 샘플 순회 |
| **j+=10 (stride 10)** | **55.80 ms**  | 11,947,200      | 여전히 체감 지연 가능           |
| **동적 stride**       | **15.77 ms**  | 1,244,500       | 가장 빠름, 바당 약 20회 유지    |

## 세 구간 요약:

| 구간       | j++ (stride 1)            | j+=10 (stride 10)         | 동적 stride             |
| ---------- | ------------------------- | ------------------------- | ----------------------- |
| **20초**   | 3.76 ms (95만 회)         | 0.57 ms (9.6만 회)        | 0.75 ms (1만 회)        |
| **284초**  | 52.75 ms (1,363만 회)     | 5.16 ms (136만 회)        | 1.63 ms (14.2만 회)     |
| **2489초** | **197.18 ms** (1.19억 회) | **55.80 ms** (1,195만 회) | **15.77 ms** (124만 회) |

---

## 해석

- **동적 stride**가 j++ 대비 **약 12.5배**, j+=10 대비 **약 3.5배** 빠름.
- 41분 파일에서도 **약 15.77 ms**로 끝나서 UI 블로킹이 거의 없음.
- j++ 197 ms는 사용자가 “잠깐 멈췄다”고 느낄 수 있는 수준.

---

## 결론: stride 세 가지 방식 비교

| 방식                  | 특징                                                                                                          | 적합한 경우                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **j++ (stride 1)**    | 구간 내 모든 샘플 순회. 연산량·시간이 오디오 길이에 비례해 가장 많이 증가.                                    | 실사용 비권장 (긴 파일에서 체감 지연)                     |
| **j+=10 (stride 10)** | 10개마다 한 번만 샘플링. 짧은 파일에서는 가장 빠르게 나올 수 있으나, 길이가 길어지면 연산량·시간이 계속 증가. | 짧은 오디오만 쓸 때 고려 가능                             |
| **동적 stride**       | 바당 약 20회로 고정해 샘플링. 오디오 길이와 관계없이 바당 연산량이 일정.                                      | **전 구간(짧은/긴 오디오) 공통으로 사용하기에 가장 적합** |

> 질문: 왜 짧은 오디오에서는 동적 stride 가 stride 10 보다 더 느리게 나왔을까?

## 1. 측정 오차 가능성 (가장 유력)

- 차이는 **0.18ms**로 매우 작음.
- console.time 해상도, 백그라운드 작업, GC 등에 의해 이 정도는 쉽게 튈 수 있음.
- 같은 파일로 여러 번 돌리면 순서가 바뀌거나 비슷해지는 경우가 많음.

→ **실제 성능 차이가 아니라 노이즈일 가능성이 큼.**

---

## 2. 바마다 stride를 다시 계산하는 비용

동적 stride는 **매 바(499번)**마다 다음을 계산합니다.

```ts
const stride = strideMode === 'dynamic' ? Math.max(1, Math.floor(step / 20)) : strideMode;
```

- j+=10: stride는 상수 10만 사용 → 추가 연산 없음.
- 동적: 바마다 비교 1번 + 나눗셈 + Math.floor + Math.max (499번 반복).

이때:

- **내부 루프**는 동적이 10,479회, j+=10이 96,307회로 동적이 약 9배 적음.
- 반면 동적은 **바당 연산 수**가 적어서(21회), “루프 1회당 비용”이 상대적으로 커 보일 수 있음.
- 그래서 **루프 자체는 매우 가벼운데**, 바당 stride 계산이 조금이라도 더해지면, 짧은 오디오처럼 전체 연산량이 작을 때 **그 차이가 비율로는 더 크게 보일 수 있음.**

즉, “이론상 연산 수는 동적이 훨씬 적은데, 짧은 구간에서는 바당 오버헤드가 상대적으로 눈에 띄었다” 정도로 설명할 수 있음.

---

## 3. JIT / 최적화 차이

- j += 10처럼 **상수 stride**는 엔진이 루프를 더 공격적으로 최적화하기 쉬움.
- j += stride처럼 **변수 stride**는 최적화가 조금 덜 aggressive할 수 있음.
- 연산량이 적을 때(짧은 오디오)는 이런 최적화 차이가 0.1~0.2ms 수준으로 드러날 수 있음.

---

그래서 다시 테스트:

## stride 비교 요약 (전 구간)

| duration             | j++ (stride 1)    | j+=10 (stride 10) | 동적 stride           |
| -------------------- | ----------------- | ----------------- | --------------------- |
| **20초**             | 3.76 ms / 1.51 ms | 0.57 ms / 0.39 ms | 0.75 ms / **0.16 ms** |
| **284초** (~4.7분)   | 52.75 ms          | 5.16 ms           | 1.63 ms               |
| **2489초** (~41.5분) | 197.18 ms         | 55.80 ms          | 15.77 ms              |
| **5722초** (~95분)   | **428.52 ms**     | **108.03 ms**     | **35.43 ms**          |

(20초는 두 번 측정한 값 둘 다 표기.)

## **최종 결론!!**

- **95분 오디오**에서도 동적 stride는 **약 35ms**로, j++(428ms)·j+=10(108ms)보다 훨씬 빠르고, 길이에 비해 선형으로 잘 스케일함.
- **20초 재측정**에서는 동적 stride가 **0.16ms**로 가장 빠름 → 짧은 구간에서 처음에 동적이 더 느리게 나온 것은 **측정 오차(분산)** 로 보는 게 타당함.
- **실사용 권장:** 짧은/긴 구간 모두 **동적 stride**를 쓰는 것이 가장 일관되고 유리함.

### 6-2. 성능 개선 비율

**20초 오디오:**

- j++ 대비: 약 **23.5배** 개선
- j+=10 대비: 약 **3.6배** 개선

**95분 오디오:**

- j++ 대비: 약 **12배** 개선
- j+=10 대비: 약 **3배** 개선

### 6-3. 왜 동적 Stride가 더 좋을까?

**1. 일관된 성능**

- j+=10: 오디오가 길어질수록 처리 시간 증가 (0.57ms → 108ms)
- 동적 stride: 오디오가 길어져도 완만하게 증가 (0.16ms → 35ms)

**2. 연산량의 차이**

95분 오디오 기준:

- j+=10: 2,520만 회 반복
- 동적 stride: 286만 회 반복 → **약 9배 적음**

**3. 스케일링**

- 동적 stride는 바당 약 20회로 고정
- 오디오 길이가 늘어나도 바 개수만 늘어날 뿐
- 계산 복잡도: O(barCount × 20) = O(barCount)

### 6-4. 시각적 품질은?

가장 중요한 건 사용자가 보는 화면이다.

테스트 결과:

- stride 1, stride 10, 동적 stride 파형을 겹쳐놓고 비교
- 육안으로 차이를 거의 발견할 수 없음
- Peak의 위치와 크기가 거의 동일하게 유지됨

**왜 품질 저하가 없을까?**

오디오의 연속성 때문이다.

- 44.1kHz에서 20샘플 간격 = 약 0.45ms
- 이 정도 간격이면 peak를 놓칠 가능성이 극히 낮음
- 실제로 급격한 소리 변화도 수백 샘플에 걸쳐 일어남

**"성능도 좋고, 품질도 유지되고, 완벽하잖아!"**

---

## 7. 배운 점

### 7-1. 측정 없이는 최적화도 없다

"느린 것 같다"는 느낌만으로는 부족하다.

- console.time으로 구간별 측정
- DevTools Performance 프로파일링
- 정확한 숫자로 병목 지점 파악

측정이 모든 최적화의 시작이다.

### 7-2. 모든 데이터를 볼 필요는 없다

특히 시각화에서는 더욱 그렇다.

- 사용자 화면은 픽셀 단위
- 1픽셀에 수천 개 샘플이 압축됨
- 전부 보는 건 과도한 정확도

목적에 맞는 적절한 수준의 정확도가 중요하다.

### 7-3. 고정값보다 동적 적용이 낫다

처음엔 stride 10으로 만족했지만, 더 긴 오디오를 테스트하면서 한계를 발견했다.

**고정 stride의 문제:**

- 짧은 오디오: 과도한 샘플링 (낭비)
- 긴 오디오: 여전히 많은 반복

**동적 stride의 장점:**

- 바당 일정한 횟수로 샘플링
- 오디오 길이에 무관하게 일관된 성능
- 계산 복잡도가 선형적으로 증가

### 7-4. 레퍼런스의 중요성

혼자 고민하지 말고 다른 사람들의 해결책을 찾아보자.

- webaudio-peaks의 samplesPerPixel
- Wavesurfer.js의 chunk 처리
- BBC audiowaveform의 다운샘플링

선배 개발자들의 경험에서 배울 수 있다.

### 7-5. 작은 아이디어, 큰 효과

```ts
// 고정 stride
for (let j = start; j < end; j += 10) { ... }

// 동적 stride
const stride = Math.max(1, Math.floor(samplesPerBar / 20));
for (let j = start; j < end; j += stride) { ... }
```

단 한 줄 추가로 3배~12배의 추가 개선. 때로는 복잡한 알고리즘 변경이 아니라, 문제의 본질을 꿰뚫는 작은 아이디어가 더 효과적이다.

---

## 8. 추가 최적화 가능성

현재 동적 stride로도 충분하지만, 더 개선할 여지는 있다:

### 8-1. Web Worker로 이동

```ts
// 메인 스레드 블로킹 제거
const worker = new Worker('peaks-worker.js');
worker.postMessage({ audioBuffer });
worker.onmessage = e => {
  const peaks = e.data;
  drawWaveform(peaks);
};
```

95분 오디오도 35ms면 충분히 빠르지만, Web Worker로 이동하면 메인 스레드를 완전히 자유롭게 할 수 있다.

### 8-2. Progressive Rendering

```ts
// 일부 peak를 먼저 그리고 나머지는 점진적으로
const initialPeaks = extractPeaks(audioBuffer, 500); // 적은 바
drawWaveform(initialPeaks);

setTimeout(() => {
  const fullPeaks = extractPeaks(audioBuffer, 1500); // 전체
  drawWaveform(fullPeaks);
}, 0);
```

### 8-3. 캐싱

```ts
// 같은 파일은 다시 계산하지 않기
const peakCache = new Map();
const cacheKey = `${audioBuffer.duration}-${barCount}`;

if (peakCache.has(cacheKey)) {
  return peakCache.get(cacheKey);
}

const peaks = extractPeaks(audioBuffer, barCount);
peakCache.set(cacheKey, peaks);
return peaks;
```

---

## 9. 마무리

긴 오디오 로딩 문제를 해결하는 여정에서:

1.  정확한 측정으로 병목을 찾았고
2.  레퍼런스 조사로 해결책의 방향을 잡았으며
3.  고정 stride로 10배 개선을 이뤘고
4.  **동적 stride로 추가로 3배~12배 더 개선**했다

가장 중요한 교훈은:

> "모든 데이터를 처리할 필요는 없다. 목적에 맞는 적절한 수준이면 충분하다."
>
> "고정된 값보다 상황에 적응하는 알고리즘이 더 강력하다."

파형 시각화는 픽셀 단위로 사용자에게 보인다. 수백만 개의 샘플을 전부 확인하는 건 과도한 정확도였다. 처음엔 stride 10으로 샘플링해도 시각적 품질이 거의 동일했고, 성능은 극적으로 개선됐다. 하지만 긴 오디오를 테스트하면서 한계를 발견했고, 동적 stride로 바꿔서 오디오 길이에 상관없이 일관된 성능을 얻을 수 있었다.

**최종 성능:**

- 20초 오디오: 0.16ms
- 5분 오디오: 약 2ms (추정)
- 41분 오디오: 15.77ms
- 95분 오디오: 35.43ms

반성할 점은, 사실 이런 문제를 맞닥뜨렸을때, 잠시나마 "그냥 파일 길이 제한을 걸까..?" 하고 편한길을 생각했다는 것이다. 이러한 자신을 반성하며 오늘도 다짐한다.

> 개발자 친화적이 아닌 유저 친화적인 ux를 고려하는 개발자가 되자!

---

## 참고:

- [CNN 기본 전문 용어 모음](https://sdk17586.tistory.com/83)
- [https://www.npmjs.com/package/webaudio-peaks](https://www.npmjs.com/package/webaudio-peaks)
- [How can I make bbc/audiowaveform peaks match wavesurfer.js'? · katspaugh wavesurfer.js · Discussion #2769](https://github.com/katspaugh/wavesurfer.js/discussions/2769)
- [Reduce memory consumption by chunking mediaenhancement](https://github.com/katspaugh/wavesurfer.js/issues/557)

## 참고 사례:

**webaudio-peaks 라이브러리**

이 라이브러리는 AudioBuffer에서 peak를 추출할 때 samplesPerPixel 파라미터로 **구간당 샘플 수를 제한**합니다. 예: 1픽셀당 1000개 샘플만 검사 → stride와 유사한 다운샘플링 효과. 긴 오디오에서 메모리와 시간을 대폭 절감합니다.

[https://www.npmjs.com/package/webaudio-peaks](https://www.npmjs.com/package/webaudio-peaks)

**Wavesurfer.js 최적화**

- sampleSize=10으로 평균화: peak 배열을 10개씩 묶어 평균 계산 (stride 10과 동일).
- Chunk 기반 처리: 긴 파일을 청크로 나누어 peak 계산 후 병합, 메모리 1/10 수준 유지.
- Pre-generated peaks: BBC audiowaveform으로 미리 계산한 데이터 로드.
- [Reduce memory consumption by chunking media**enhancement**](https://github.com/katspaugh/wavesurfer.js/issues/557)

**BBC audiowaveform 도구**

- pixels-per-second 1 옵션으로 **초당 1픽셀 해상도** 다운샘플링. Wavesurfer.js와 함께 사용 시 로딩 속도 10배 향상. outlier(이상치) 처리로 파형이 과도하게 두껍지 않게 합니다.
- [Generating Waveform Data - audio representation](https://matt.aimonetti.net/posts/2019-06-generating-waveform-data-audio-representation/)
