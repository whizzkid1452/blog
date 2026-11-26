---
title: '[Part 5.] 오디오 Export는 Encode 한 번으로 끝나지 않았다'
description: 'Render, Normalize, True Peak Limit, Dither, Encode 순서를 고정한 오프라인 Export 파이프라인 설계와 Stem 처리, 중단, 오류 전달의 한계를 공유해요.'
date: '2026-03-07'
publishedAt: '2026-03-07T14:00:00+09:00'
tags: ['daw', 'audio', 'typescript', 'export', 'architecture']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 5
draft: false
visibility: public
---

처음 오디오 Export를 구상할 때는 꽤 단순하게 생각했어요. 현재 세션을 `AudioBuffer` 하나로 렌더링하고, 그걸 WAV 파일로 바꾸면 끝날 것 같았거든요.

하지만 실제 요구사항을 정리해 보니 이야기가 달라졌어요. Loudness Normalize, True Peak 제한, Bit Depth 변환, Dither, MP3, OGG, FLAC 같은 다양한 포맷, 거기에 트랙별로 따로 뽑는 Stem Export까지 한꺼번에 들어왔거든요.

각 기능을 구현하는 것보다 더 까다로웠던 건 **순서**였어요. Normalize 뒤에 Peak가 다시 커질 수 있고, Dither는 양자화 바로 직전에 적용해야 의미가 있거든요. 트랙별 Stem은 같은 파이프라인을 반복하지만 진행률 계산과 중단 시점이 또 달라지죠.

그래서 Export를 **단계가 고정된 오프라인 파이프라인**으로 모델링했어요.

## [sort1] 1. 왜 처리 순서를 먼저 고정했을까요?

현재 오프라인 Export 파이프라인은 아래 순서를 따르고, Normalize, True Peak Limit, Dither는 설정에 따라 적용해요.

```text
Offline Render
→ Normalize (Peak / LUFS)
→ True Peak Limit
→ Dither
→ Encode (WAV / MP3 / OGG / FLAC)
```

```mermaid
flowchart LR
  A["Session과 Track"] --> B["Offline Render"]
  B --> C["Normalize"]
  C --> D["True Peak Limit"]
  D --> E["Dither"]
  E --> F["Encode"]
  F --> G["Blob과 File Name"]
```

이 순서는 하나라도 바뀌면 결과가 달라져요.

- **Normalize**로 목표 레벨까지 전체 Gain을 조정해요.
- 그 뒤에 **True Peak Limit**를 적용해야 Normalize 결과가 상한선(Ceiling)을 넘는지 다시 잡아 줄 수 있어요.
- **Dither**는 Float PCM을 낮은 Bit Depth로 양자화할 때 생기는 오차를 미세한 노이즈로 분산하는 과정이라 반드시 Encode 바로 직전에 있어야 해요.

> “오디오 파이프라인에서는 어떤 처리를 했는지보다 **어떤 순서로 연결했는지**가 결과를 바꿔요.”

## [sort1] 2. 렌더링 구현은 Callback 경계 밖으로 밀어냈어요

DAW Core가 Web Audio나 네이티브 백엔드를 직접 소유하지 않기 때문에 Exporter도 세션을 직접 렌더링하지 않아요. 대신 트랙 목록과 Frame 범위를 받아 AudioBuffer를 돌려주는 콜백을 요구해요.

```ts
type RenderTrackAudio = (trackIds: string[], startFrame: number, endFrame: number) => Promise<AudioBuffer>;
```

Exporter는 "어떻게 소리를 만드는가"가 아니라 "받은 PCM을 어떤 순서로 처리하는가"에 집중해요.

```ts
const renderedBuffer = await renderTrackAudio(selectedTrackIds, config.startFrame, config.endFrame);
```

이 경계 덕분에 백엔드 구현이 바뀌어도 후처리 순서는 그대로 유지할 수 있어요. 반대로 콜백이 올바른 Sample Rate와 채널 구성을 반환한다는 계약은 외부에 남고, Exporter가 이를 다시 검증하는 코드는 아직 제한적이에요.

## [sort1] 3. 같은 Normalize라도 Peak와 Loudness는 달라요

Peak Normalize는 전체 채널에서 가장 큰 절댓값을 찾아 목표 dBFS까지 Gain을 적용해요.

```ts
function normalizePeak(buffer: AudioBuffer, targetPeakDb: number): void {
  let maximumPeak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    for (const sample of buffer.getChannelData(channel)) {
      maximumPeak = Math.max(maximumPeak, Math.abs(sample));
    }
  }

  if (maximumPeak === 0) {
    return;
  }

  const targetLinear = 10 ** (targetPeakDb / 20);
  const gain = targetLinear / maximumPeak;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index++) {
      samples[index] *= gain;
    }
  }
}
```

반면 LUFS Normalize는 Part 2에서 다룬 K-weighting과 Gate를 적용해 측정한 Integrated Loudness와 목표값의 차이를 Gain으로 사용해요. 익스포트는 이 계산을 별도의 `LufsNormalizer`에서 처리해요. 같은 Normalize라는 이름을 쓰지만 Peak Normalize는 **순간 최댓값**을 맞추고, LUFS Normalize는 **프로그램 전체의 인지 음량**에 가까운 값을 맞추는 작업이에요. UI와 설정에서도 둘을 명시적으로 구분해야 해요.

## [sort1] 4. Dither는 Bit Depth 정책과 묶었어요

현재 구현은 출력 샘플 포맷이 int16이나 int24일 때만 Dither를 적용하고, float32에는 적용하지 않아요.

TPDF(Triangular Probability Density Function)는 두 난수의 차이를 이용해 삼각 분포 노이즈를 만들어요.

```ts
function quantizeWithTpdf(sample: number, bitDepth: number): number {
  const scale = 2 ** (bitDepth - 1);
  const quantizationStep = 1 / scale;
  const noise = (Math.random() - Math.random()) * quantizationStep;

  return Math.round((sample + noise) * scale) / scale;
}
```

Noise-shaped 방식은 이전 양자화 오차를 다음 샘플에 일부 반영해요. 이 경우 채널마다 에러 상태를 따로 관리해야 해요.

다만 현재 Exporter는 파일 포맷이 아니라 sampleFormat을 기준으로 Dither 여부를 정해요. 그래서 MP3나 OGG 같은 손실 압축 경로에서도 설정에 따라 PCM Dither가 먼저 적용될 수 있어요. 무손실 PCM과 손실 코덱의 전처리 정책을 분리하는 편이 더 정확해요.

## [sort1] 5. 포맷별 Encode 경로를 한곳에 모았어요

후처리가 끝난 AudioBuffer는 설정에 따라 포맷별 인코더로 전달돼요.

```ts
switch (config.format) {
  case 'wav':
    return encodeWav(buffer, config.sampleFormat);
  case 'mp3':
    return encodeMp3(buffer, config.bitrate);
  case 'ogg':
    return encodeOgg(buffer, config.quality);
  case 'flac':
    return encodeFlac(buffer, config.sampleFormat);
  default:
    throw new Error(`Unknown format: ${config.format}`);
}
```

WAV는 PCM 바이트와 RIFF 헤더를 직접 구성하고, MP3는 Float32 PCM을 Int16으로 클램핑해 인코더에 전달해요. OGG와 FLAC도 별도 구현 경로가 있어요.

다만 각 포맷의 결과 파일을 외부 디코더로 다시 열어 원본 길이, 채널, Sample Rate, 메타데이터를 확인하는 자동 테스트는 아직 없어요. 현재 확인된 사실은 "포맷별 코드 경로가 존재한다"까지이고, 모든 플레이어와 호환된다고 결론 내리려면 디코드 검증이 필요해요.

## [sort1] 6. Stem Export와 중단의 경계

Master Export는 선택된 트랙을 한 번에 렌더링하지만, Stem Export는 트랙을 하나씩 렌더링하고 각각 인코딩해요.

```ts
for (let index = 0; index < trackIds.length; index++) {
  if (status.aborted) {
    break;
  }

  const trackId = trackIds[index];
  const renderedBuffer = await renderTrackAudio([trackId], config.startFrame, config.endFrame);

  const blob = await encode(renderedBuffer, config);
  results.set(trackId, { blob, filename: createStemName(trackId) });
  status.updateProcessedFrames(duration * (index + 1));
}
```

트랙 이름에서 파일명으로 쓸 수 없는 문자는 _로 바꾸고, 진행률은 전체 트랙 수와 각 트랙의 길이를 곱한 작업량을 기준으로 갱신해요.

현재 중단 처리는 Stem 반복문 시작점에서만 확인해요. 이미 시작한 Render, Normalize, Encode를 중간에 취소하지는 못하고, Master Export도 단계 사이에서 `aborted`를 확인하지 않아요. 정확히는 "트랙 사이에서 중단 가능한 Stem Export"이고, 단계 내부 취소까지는 아직 지원하지 않아요.

## [sort1] 7. 에러를 상태로 바꿀 때의 계약 문제

Master Export는 내부 오류를 잡아서 ExportStatus의 Error 상태로 바꿔요. UI가 상태 객체 하나만 구독하기에는 편하지만, 호출자 입장에서는 Promise가 reject되지 않고 완료될 수 있어요. try/catch만 사용하면 실패를 놓치게 되죠.

이 문제를 풀 선택지는 두 가지예요.

- 실패 상태를 기록한 뒤 에러를 다시 throw한다.
- `Result<ExportArtifact, ExportError>`를 반환해 성공과 실패 처리를 타입으로 강제한다.

어느 방식을 택하든 UI와 Command Handler가 같은 실패 계약을 써야 해요. 상태 기록과 예외를 함께 쓸 때는 어느 쪽이 기준인지 분명히 정해야 하거든요.

## [sort1] 8. 어떤 검증이 있어야 Export가 완료될까요?

현재 Export 경로는 Command와 Handler에 연결되어 있지만 자동 테스트는 없어요. 아래 검증이 필요해요.

- 무음과 최대 진폭 PCM의 Peak Normalize
- 목표 LUFS 적용 전후의 측정값 비교
- True Peak Limit 이후 Ceiling 초과 여부
- 16, 24, 32 bit WAV 헤더와 PCM 길이
- Dither 적용 전후의 양자화 오차 분포
- MP3, OGG, FLAC 디코드 왕복(Round-trip) 검증
- Mono, Stereo, 다채널 파일 처리
- Master와 Stem의 동일 트랙 결과 일치 여부
- 중단 요청 시 새 트랙 렌더링이 시작되지 않는지
- 렌더링과 인코딩 오류가 UI 상태와 호출자 양쪽에 전달되는지

코덱 호환성은 Blob의 MIME 타입이나 확장자만으로 검증할 수 없어요. 실제 디코더가 파일을 열고 기대한 길이와 채널 정보를 반환해야 해요.

## [sort1] 9. 마치며

오디오 Export에서 '완료'는 단순히 Blob을 하나 만들었다는 뜻이 아니에요. 선택한 음질 정책과 파일 계약을 끝까지 지켰다는 뜻이어야 하죠. Normalize, True Peak 제한, Dither, Stem Export를 한 파이프라인에 얹어 보니, 개별 인코더를 붙이는 일보다 **처리 순서를 고정하고 백엔드, UI, 인코더 사이의 실패와 중단 계약을 명확히 세우는 일**이 훨씬 중요하더라고요.

지금 구조는 렌더링을 콜백 경계 밖으로 분리하고 Master와 Stem 경로를 제공하지만, 코덱별 디코드 왕복 검증과 단계 내부 취소, 그리고 실패 계약 통일은 아직 남아 있어요. 실제 디코더가 결과 파일을 열어 길이와 채널을 확인하는 테스트부터 차례로 채워 나가려고 해요.

여기까지 오프라인으로 결과물을 뽑아내는 순서를 정리했다면, 다음 글에서는 분기와 합류가 얽힌 실시간 오디오 프로세서들의 실행 순서를 DAG(방향 비순환 그래프)로 모델링한 이야기를 다뤄 볼게요.

## 참고

- [Web Audio API 1.1](https://www.w3.org/TR/webaudio-1.1/)
- [ITU-R BS.1770-5, Algorithms to measure audio programme loudness and true-peak audio level](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I)
- [Library of Congress, WAVE Audio File Format](https://www.loc.gov/preservation/digital/formats/fdd/fdd000001.shtml)
- [How Browser Audio Works: The Web Audio API Explained](https://trimr.net/web-audio-api-how-browser-audio-works)
