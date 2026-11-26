---
title: '[Part 4.] MIDI 파일은 Note 배열이 아니라 Event Stream이었다'
description: 'Standard MIDI File의 Chunk, Delta Time, VLQ, Running Status를 직접 파싱하고, 흩어진 Note On/Off 이벤트를 도메인 객체로 조립했다가 다시 파일로 쓰는 구조를 정리했어요.'
date: '2026-01-30'
publishedAt: '2026-01-30T13:00:00+09:00'
tags: ['daw', 'midi', 'typescript', 'binary', 'parser']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 4
draft: false
visibility: public
---

DAW 화면에서 보는 MIDI 노트는 아주 직관적이에요. 시작 시간(`startTick`)과 길이(`durationTicks`)를 가진 깔끔한 객체잖아요?

그래서 처음 MIDI 파일(`.mid`) 불러오기 기능을 만들 때는 JSON 배열을 파싱하는 것과 비슷할 줄 알았어요. 그런데 표준 MIDI 파일(Standard MIDI File, SMF) 스펙을 열어 보니 구조가 전혀 달랐어요. 파일 안에는 완성된 Note 객체가 없거든요. 대신 Note On(건반을 눌렀다)과 Note Off(건반에서 손을 뗐다)라는 두 이벤트가 시간순으로 흘러갈 뿐이고, 시간도 절대값이 아니라 바로 이전 이벤트와의 차이인 **Delta Time**으로 저장돼요.

결국 MIDI Import는 바이트 오프셋을 옮겨 가며 Chunk와 Event를 해석하고, 서로 떨어져 있는 Note On과 Note Off의 짝을 맞춰 하나의 도메인 객체로 조립하는 과정이었어요.

이번 구현에서는 SMF Header와 Track Chunk, Note Event, Track Name, Tempo, SysEx 건너뛰기, VLQ(Variable-Length Quantity), Running Status를 처리해요. 다만 Control Change나 Pitch Bend 같은 이벤트는 보존하지 않고, 외부 DAW 파일과의 호환성 자동 테스트도 아직 남아 있어요.

## [sort1] 1. 파일의 첫 14바이트부터 계약을 확인했어요

모든 표준 MIDI 파일은 `MThd`라는 4바이트 시그니처로 시작하는 Header Chunk를 가지고 있어요.

```text
4 bytes  MThd
4 bytes  header length
2 bytes  format
2 bytes  track count
2 bytes  time division
```

숫자는 모두 **Big-endian**으로 저장돼요. 바이트 배열을 직접 비트 시프트하며 읽는 것보다, JavaScript의 `DataView`를 써서 endian을 명시하는 편이 의도가 훨씬 분명하고 실수도 적었어요.

```ts
function readHeader(view: DataView): MidiHeader {
  const headerTag = readAscii(view, 0, 4);

  if (headerTag !== 'MThd') {
    throw new Error('Not a valid MIDI file: missing MThd header');
  }

  return {
    format: view.getUint16(8, false),
    trackCount: view.getUint16(10, false),
    division: view.getUint16(12, false),
  };
}
```

Header 길이를 읽은 뒤에는 각 트랙(`MTrk` Chunk)의 길이를 기준으로 다음 오프셋을 계산해요. 중간에 이벤트 해석이 실패하더라도 다른 트랙의 시작 위치를 추측해서는 안 돼요. **바이너리 파서에서는 오프셋이 곧 상태**니까요.

## [sort1] 2. Delta Time은 가변 길이(VLQ)로 저장되어 있었어요

MIDI의 Delta Time과 여러 길이 필드는 VLQ(Variable-Length Quantity)라는 가변 길이 인코딩을 써요. 한 바이트의 하위 7비트에 값을 담고, 최상위 비트가 `1`이면 다음 바이트가 이어진다는 뜻이에요.

```text
0xxxxxxx                    -> 1 byte
1xxxxxxx 0xxxxxxx           -> 2 bytes
1xxxxxxx 1xxxxxxx 0xxxxxxx  -> 3 bytes
```

파서는 기존 값을 왼쪽으로 7비트 이동한 뒤 새 바이트의 하위 7비트를 합쳐요.

```ts
function readVlq(view: DataView, startOffset: number): [value: number, length: number] {
  let value = 0;
  let length = 0;

  while (startOffset + length < view.byteLength) {
    const byte = view.getUint8(startOffset + length);
    value = (value << 7) | (byte & 0x7f);
    length++;

    if ((byte & 0x80) === 0 || length >= 4) {
      break;
    }
  }

  return [value, length];
}
```

반대로 파일로 쓸 때(Writer)는 하위 7비트부터 꺼내 continuation 비트를 설정하고 순서를 뒤집어요. 파서와 Writer가 같은 숫자 표현을 공유하기 때문에 VLQ는 가장 먼저 왕복 테스트를 붙여야 할 단위예요.

## [sort1] 3. Running Status는 이전 이벤트의 상태를 기억해요

MIDI 파일을 파싱하다 보면 한 번쯤 헷갈리는 규칙이 바로 **Running Status**예요. 같은 종류의 Channel Event가 연속될 때, 용량을 아끼려고 앞의 Status 바이트를 생략할 수 있거든요.

```text
90 3C 64  -> Note On, pitch 60, velocity 100
   40 64  -> (90 생략) 같은 채널의 Note On, pitch 64, velocity 100
```

두 번째 이벤트의 첫 바이트 `0x40`은 `0x80`보다 작아요. 파서는 이걸 새 Status가 아니라 직전 Status(`0x90`)의 첫 번째 데이터 바이트로 해석해야 해요.

```ts
let previousStatus = 0;
let statusByte = view.getUint8(offset);

if (statusByte < 0x80) {
  statusByte = previousStatus;
} else {
  offset++;
  previousStatus = statusByte;
}
```

파일 크기를 줄이는 포맷의 특성이지만, 잘못된 오프셋 하나가 이후 모든 이벤트 해석을 어긋나게 만드는 원인이 되기도 해요.

System Common, SysEx, Meta Event가 Running Status를 어떻게 종료하는지도 명확히 해야 해요. 현재 구현은 새 Status 바이트라면 모두 `previousStatus`에 저장하고 있어서, System Event 이후의 규칙까지 확인하는 호환성 픽스처가 필요해요.

## [sort1] 4. 흩어진 Note On과 Note Off를 하나의 Note로 조립했어요

도메인 모델은 노트의 시작 Tick과 길이를 필요로 하지만, 파일은 시작과 종료 이벤트를 따로 제공해요. 그래서 파서는 현재 눌려 있는 노트를 `Map`에 보관해요.

```ts
interface ActiveNote {
  pitch: number;
  velocity: number;
  channel: number;
  startTick: number;
}

const activeNotes = new Map<string, ActiveNote>();
const noteKey = (channel: number, pitch: number) => `channel-${channel}-${pitch}`;
```

Note On을 만나면 `channel-pitch` 키로 시작점을 기록하고, Note Off를 만나면 현재 Tick과 시작 Tick의 차이로 `durationTicks`를 만들어요.

실제 MIDI 파일에서는 Note Off 대신 **Velocity가 0인 Note On**을 보내는 경우도 흔해서, 이것도 종료 신호로 처리해 줘야 해요.

```ts
if (eventType === NOTE_ON && velocity === 0) {
  finishNote(channel, pitch, currentTick);
}
```

이전 노트가 닫히지 않은 상태에서 같은 채널과 피치의 Note On이 다시 들어오면 이전 노트를 먼저 종료해요. 트랙 끝까지 Note Off가 없으면 `End of Track` Tick에서 남은 노트를 닫아요.

이렇게 하면 손상된 파일에서도 유한한 길이의 노트를 만들 수 있지만, 원본의 오류를 조용히 보정해 버린다는 트레이드오프가 있어요. 앞으로 Import 경고를 함께 반환하면 사용자가 원본 문제와 보정 결과를 구분할 수 있을 거예요.

## [sort1] 5. Meta Event와 Channel Event 분리, 그리고 지원 범위

Status 바이트의 상위 4비트는 Channel Event 종류, 하위 4비트는 채널 번호를 나타내요.

```ts
const eventType = statusByte & 0xf0;
const channel = statusByte & 0x0f;
```

현재 구현이 실제로 파싱해서 도메인에 보존하는 정보는 아래 네 가지예요.

- Note On / Note Off
- Track Name Meta Event
- Tempo Meta Event
- Track 종료 위치

Aftertouch, Control Change, Pitch Bend, Program Change, Channel Pressure는 이벤트 길이만큼 오프셋을 이동하지만 도메인 객체로 저장하지 않아요. SysEx도 길이를 읽고 건너뛰어요.

따라서 정확한 표현은 "Note 중심 MIDI Import"예요. 모든 MIDI 이벤트를 지원한다고 보기 어렵고, 특히 Tempo가 여러 번 바뀌는 파일은 전체 Tempo Map이 아니라 트랙에서 확인한 Tempo 값만 반환하고 있어 가변 Tempo Import도 추가 설계가 필요해요.

## [sort1] 6. 파일에 쓸 때 절대 Tick을 Delta Time으로 바꿨어요

Writer는 파서가 했던 일을 거꾸로 돌리면 돼요. 각 Note를 Note On과 Note Off 이벤트로 펼친 뒤 절대 Tick 순으로 정렬해요.

```ts
const events = notes.flatMap(note => [
  { tick: note.startTick, data: createNoteOn(note) },
  { tick: note.startTick + note.durationTicks, data: createNoteOff(note) },
]);

events.sort((left, right) => left.tick - right.tick);
```

정렬한 뒤 이전 이벤트 Tick과의 차이를 VLQ로 기록해요. 마지막에는 Delta Time 0과 `End of Track` Meta Event를 추가하고 전체 길이를 `MTrk` Chunk Header에 적어 주면 끝나요.

```ts
let previousTick = 0;

for (const event of events) {
  const delta = event.tick - previousTick;
  bytes.push(...writeVlq(delta), ...event.data);
  previousTick = event.tick;
}
```

```mermaid
flowchart LR
  A["Note 배열"] --> B["Note On / Off로 분해"]
  B --> C["절대 Tick 정렬"]
  C --> D["Delta Time 계산"]
  D --> E["VLQ 인코딩"]
  E --> F["MTrk Chunk 작성"]
```

## [sort1] 7. 바이너리 파서는 정상 입력보다 손상된 입력이 더 중요해요

현재 MIDI 파서와 Writer에는 자동 테스트가 없어요. 안정적으로 쓰려면 최소한 아래 케이스들을 검증해야 해요.

- VLQ의 1, 2, 3, 4바이트 경계값 왕복
- Running Status가 있는 연속 노트 입력
- Velocity 0 Note On
- Note Off가 없는 트랙 종료
- 여러 트랙을 가진 Format 1 파일
- PPQN과 SMPTE division Header 해석
- Meta, SysEx 이후 오프셋과 Running Status
- `Parser -> Writer -> Parser` 노트 왕복
- 서로 다른 DAW에서 생성한 픽스처와 결과 비교

바이너리 파서에서는 예상하지 못한 이벤트를 만났을 때 최소 1바이트 이상 이동하거나 명시적으로 실패해야 해요. 알 수 없는 이벤트에서 오프셋이 그대로 멈추면 반복문이 끝나지 않을 수 있거든요.

## [sort1] 8. 마치며

파서가 파일을 끝까지 에러 없이 읽었다는 사실이 원본 정보를 모두 보존했다는 뜻은 아니에요. 이번 MIDI 구현에서도 낯설었던 `DataView` 바이트 연산이나 VLQ 인코딩보다, **어떤 이벤트를 도메인에 남기고 무엇을 건너뛸지, 닫히지 않은 노트를 어떻게 정리할지 지원 범위와 보정 정책을 정하는 일**에 훨씬 더 많은 고민이 필요했어요.

현재는 Note 중심 Import와 Export의 기반을 갖춘 상태예요. System Event 이후의 Running Status 경계와 가변 Tempo Import를 마저 다듬고, 다양한 외부 DAW 픽스처로 왕복 테스트를 붙여 건너뛴 이벤트와 보정 내역을 Import 경고로 명시하는 것이 다음 단계예요.

이렇게 외부 MIDI 데이터를 프로젝트 안으로 불러오고 다시 써내는 경계를 정리했다면, 다음 글에서는 편집이 끝난 세션을 실제 오디오 파일로 완성해 내보내는 **Offline Export 파이프라인** 설계를 살펴볼게요.

## 참고

- [MIDI Association, Standard MIDI Files](https://midi.org/standard-midi-files)
- [MIDI 포맷에 대해 알아보자](https://pubul.tistory.com/108)
- [Standard MIDI file format, updated](https://midimusic.github.io/tech/midispec.html)
