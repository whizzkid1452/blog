---
title: '[Part 5.] 오디오 Export는 Encode 한 번으로 끝나지 않았다'
description: 'Render, Normalize, True Peak Limit, Dither, Encode 순서를 고정한 Offline Export 파이프라인과 진행 상태·Stem 처리의 한계를 설명합니다.'
date: '2026-08-03'
publishedAt: '2026-08-03T14:00:00+09:00'
tags: ['daw', 'audio', 'typescript', 'export', 'architecture']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 5
draft: false
visibility: public
---

처음 Export를 생각했을 때는 현재 Session을 하나의 `AudioBuffer`로 만들고 WAV로 바꾸면 끝날 것 같았다. 실제 요구사항에는 Loudness Normalize, True Peak 제한, Bit Depth 변환, Dither, MP3·OGG·FLAC 같은 Format, Track별 Stem이 함께 들어왔다.

각 기능보다 어려웠던 점은 순서였다. Normalize 뒤에 Peak가 다시 커질 수 있고, Dither는 양자화 직전에 적용해야 의미가 있다. Track별 Stem은 같은 파이프라인을 반복하지만 진행률과 중단 지점이 달라진다.

그래서 Export를 하나의 Encoder 호출이 아니라 단계가 있는 작업으로 모델링했다.

## [sort1] 1. 왜 처리 순서를 먼저 고정했는가

현재 Offline Export 경로의 순서는 다음과 같다.

```text
Render
→ Peak 또는 LUFS Normalize
→ True Peak Limit
→ Dither
→ Encode
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

Normalize는 목표 level까지 전체 gain을 조정한다. 그 뒤 True Peak를 제한해야 Normalize 결과가 ceiling을 넘는 상황을 다시 확인할 수 있다. Dither는 Float PCM을 낮은 Bit Depth로 양자화할 때 생기는 오차를 noise로 decorrelate하므로 Encode 직전에 있어야 한다.

> “오디오 파이프라인에서는 어떤 처리를 했는지보다 어떤 순서로 했는지가 결과를 바꾼다.”

## [sort1] 2. Render 구현을 Callback 경계 밖으로 밀어냈다

DAW Core가 실제 Web Audio나 Native Backend를 직접 소유하지 않기 때문에 Exporter도 Session을 직접 렌더링하지 않는다. 대신 Track과 Frame 범위를 받아 `AudioBuffer`를 반환하는 callback을 요구한다.

```ts
type RenderTrackAudio = (trackIds: string[], startFrame: number, endFrame: number) => Promise<AudioBuffer>;
```

Exporter는 “어떻게 소리를 만드는가”가 아니라 “받은 PCM을 어떤 순서로 처리하는가”에 집중한다.

```ts
const renderedBuffer = await renderTrackAudio(selectedTrackIds, config.startFrame, config.endFrame);
```

이 경계 덕분에 실제 Backend 구현을 바꾸더라도 후처리 순서는 유지할 수 있다. 반대로 callback이 올바른 Sample Rate와 Channel 구성을 반환한다는 계약은 외부에 남는다. Exporter가 이를 다시 검증하는 코드는 제한적이다.

## [sort1] 3. Normalize는 Peak와 Loudness를 분리했다

Peak Normalize는 전체 Channel의 가장 큰 절댓값을 찾고 목표 dBFS까지 gain을 적용한다.

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

LUFS Normalize는 K-weighting과 gate를 적용해 측정한 Integrated Loudness와 목표값의 차이를 gain으로 사용한다. 두 방식은 같은 “Normalize”라는 이름을 쓰지만 측정 기준이 다르다.

Peak Normalize는 순간 최댓값을 맞춘다. LUFS Normalize는 프로그램 전체의 인지 loudness에 가까운 값을 맞추려 한다. UI와 설정에서는 둘을 명시적으로 구분해야 한다.

## [sort1] 4. Dither는 Bit Depth 정책과 묶었다

현재 구현은 출력 Sample Format이 `int16` 또는 `int24`일 때 Dither를 적용한다. `float32`에는 적용하지 않는다.

TPDF(Triangular Probability Density Function)는 두 난수의 차이를 사용해 삼각 분포 noise를 만든다.

```ts
function quantizeWithTpdf(sample: number, bitDepth: number): number {
  const scale = 2 ** (bitDepth - 1);
  const quantizationStep = 1 / scale;
  const noise = (Math.random() - Math.random()) * quantizationStep;

  return Math.round((sample + noise) * scale) / scale;
}
```

Noise-shaped 방식은 이전 양자화 오차를 다음 Sample에 일부 반영한다. 이 경우 Channel마다 error state를 분리해야 한다.

현재 Exporter는 Format보다 Sample Format을 기준으로 Dither를 결정한다. 따라서 MP3나 OGG 같은 손실 압축 경로에서도 설정에 따라 PCM Dither가 먼저 적용될 수 있다. Lossless PCM과 Lossy Codec의 전처리 정책을 분리하는 것이 더 정확하다.

## [sort1] 5. Format별 Encode 경로를 한 곳에 모았다

후처리가 끝난 `AudioBuffer`는 설정에 따라 Format별 Encoder로 전달된다.

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

WAV는 PCM Byte와 RIFF Header를 직접 구성한다. MP3는 Float32 PCM을 Int16으로 clamp한 뒤 Encoder에 전달한다. OGG와 FLAC도 별도 구현 경로가 있다.

다만 Format별 파일을 외부 Decoder로 다시 열어 원본 길이, Channel, Sample Rate, Metadata를 확인하는 자동 테스트는 없다. 따라서 현재 확인된 사실은 “Format별 코드 경로가 존재한다”까지다. “모든 Player와 호환된다”는 결론은 낼 수 없다.

## [sort1] 6. Stem Export는 반복 작업의 진행 상태를 따로 관리했다

Master Export는 선택된 Track을 한 번에 Render한다. Stem Export는 Track을 하나씩 Render하고 각각 Encode한다.

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

Track 이름은 파일에 사용할 수 없는 문자를 `_`로 바꾼다. 진행률은 전체 Track 수와 각 Track의 duration을 곱한 작업량을 기준으로 갱신한다.

현재 중단 처리는 Stem 반복 시작점에서만 확인한다. 이미 시작한 Render, Normalize, Encode를 취소하지는 않는다. Master Export 경로도 단계 사이에서 `aborted`를 확인하지 않는다. 따라서 정확한 표현은 “Track 사이에서 중단 가능한 Stem Export”다. 즉시 취소나 단계 내부 취소는 아직 아니다.

## [sort1] 7. 에러를 상태로 바꾸는 것에도 계약이 필요했다

Master Export는 내부 오류를 잡아 `ExportStatus`의 Error 상태로 바꾼다. 호출자 입장에서는 Promise가 reject되지 않고 완료될 수 있다.

이 방식은 UI가 하나의 상태 객체만 구독하기에는 편하다. 하지만 호출자가 `try/catch`만 사용하면 실패를 놓칠 수 있다.

선택지는 두 가지다.

1. 실패 상태를 기록한 뒤 Error를 다시 throw한다.
2. `Result<ExportArtifact, ExportError>`를 반환해 성공과 실패를 타입으로 강제한다.

어느 방식이든 UI와 Command Handler가 같은 실패 계약을 사용해야 한다. 상태 기록과 예외 처리를 동시에 사용할 때는 어느 쪽이 authoritative한지 정해야 한다.

## [sort1] 8. 어떤 검증이 있어야 Export가 완료되는가

현재 Export 경로는 Command와 Handler에 연결돼 있지만 자동 테스트는 없다. 다음 검증이 필요하다.

- 무음과 최대 진폭 PCM의 Peak Normalize
- 목표 LUFS 적용 전후의 측정값
- True Peak Limit 이후 ceiling 초과 여부
- 16·24·32 bit WAV Header와 PCM 길이
- Dither 적용 전후 양자화 오차 분포
- MP3·OGG·FLAC Decode Round Trip
- Mono·Stereo·다채널 파일
- Master와 Stem의 동일 Track 결과 비교
- 중단 요청 시 새 Track Render가 시작되지 않는지
- Render와 Encode 오류가 UI 상태와 호출자에게 전달되는지

Codec 호환성은 Blob의 MIME Type이나 파일 확장자만으로 검증할 수 없다. 실제 Decoder가 파일을 열고 기대한 duration과 channel 정보를 반환해야 한다.

## [sort1] 9. Export는 음질 정책을 실행 순서로 표현하는 작업이었다

Offline Export를 구현하면서 각 알고리즘을 따로 만드는 것보다 처리 순서를 고정하고, Backend·UI·Encoder 사이의 실패 계약을 정하는 일이 더 어려웠다.

현재 구조는 Render와 후처리 책임을 분리하고 Master·Stem 경로를 제공한다. 반면 Format별 검증과 단계 내부 취소는 남아 있다.

> “Export 완료는 Blob을 만들었다는 뜻이 아니라, 선택한 음질 정책과 파일 계약을 검증했다는 뜻이어야 한다.”

다음 단계는 Codec Decode Round Trip fixture와 취소 가능한 단계 계약을 추가하는 것이다.
