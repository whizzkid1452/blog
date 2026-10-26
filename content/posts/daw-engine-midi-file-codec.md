---
title: '[Part 4.] MIDI 파일은 Note 배열이 아니라 Event Stream이었다'
description: 'Standard MIDI File의 Chunk, Delta Time, VLQ, Running Status와 Note 수명 주기를 직접 파싱하고 다시 쓰는 구조를 설명합니다.'
date: '2026-01-30'
publishedAt: '2026-01-30T13:00:00+09:00'
tags: ['daw', 'midi', 'typescript', 'binary', 'parser']
series:
  name: 'TypeScript DAW 엔진 구현기'
  order: 4
draft: false
visibility: public
---

애플리케이션에서 MIDI Note는 시작 시간과 길이를 가진 객체다. 하지만 Standard MIDI File(SMF) 안에는 그런 객체가 그대로 들어 있지 않다. Note On과 Note Off라는 두 Event가 시간순으로 기록되고, 시간도 절대값이 아니라 이전 Event와의 차이인 Delta Time으로 저장된다.

그래서 MIDI Import는 JSON을 읽는 작업이 아니었다. Byte offset을 이동하며 Chunk와 Event를 해석하고, 서로 떨어진 Note On·Off를 하나의 도메인 객체로 조립하는 작업이었다.

이번 구현은 SMF Header와 Track Chunk, Note Event, Track Name, Tempo, SysEx 건너뛰기, Variable-Length Quantity(VLQ), Running Status를 처리한다. 다만 Control Change와 Pitch Bend 등은 읽어서 보존하지 않고, 외부 DAW와의 호환성 자동 테스트도 없다.

## [sort1] 1. 파일의 첫 14 Byte부터 계약을 확인했다

MIDI 파일은 `MThd` Header Chunk로 시작한다.

```text
4 bytes  MThd
4 bytes  header length
2 bytes  format
2 bytes  track count
2 bytes  time division
```

숫자는 Big-endian으로 저장된다. JavaScript의 `DataView`는 endian을 명시할 수 있으므로 Byte 배열을 직접 shift하는 코드보다 의도가 분명하다.

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

Header 길이를 읽은 뒤에는 각 `MTrk` Chunk의 길이를 기준으로 다음 offset을 계산한다. Event를 해석하다 실패하더라도 다른 Track의 시작 위치를 추측해서는 안 된다. Binary parser에서는 offset이 곧 상태다.

## [sort1] 2. Delta Time은 VLQ로 저장됐다

MIDI의 Delta Time과 여러 길이 필드는 VLQ를 사용한다. 한 Byte의 하위 7 bit가 값이고, 최상위 bit가 1이면 다음 Byte가 이어진다.

```text
0xxxxxxx                       1 byte
1xxxxxxx 0xxxxxxx             2 bytes
1xxxxxxx 1xxxxxxx 0xxxxxxx    3 bytes
```

Parser는 기존 값을 7 bit 왼쪽으로 이동한 뒤 새 Byte의 하위 7 bit를 합친다.

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

Writer는 반대로 하위 7 bit부터 꺼낸 뒤 continuation bit를 설정하고 순서를 뒤집는다. Parser와 Writer가 같은 숫자 표현을 공유하므로 VLQ는 가장 먼저 왕복 테스트해야 할 단위다.

## [sort1] 3. Running Status 때문에 현재 Byte만 봐서는 Event를 알 수 없었다

Channel Event가 연속될 때 MIDI 파일은 같은 Status Byte를 생략할 수 있다. 이것이 Running Status다.

```text
90 3C 64   Note On, pitch 60, velocity 100
   40 64   같은 channel의 Note On, pitch 64, velocity 100
```

두 번째 Event의 첫 Byte `0x40`은 0x80보다 작다. Parser는 이를 새 Status가 아니라 이전 Status의 첫 data byte로 해석해야 한다.

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

이 로직은 상태를 줄여 파일 크기를 줄이는 포맷의 특성을 반영한다. 동시에 잘못된 offset 하나가 이후 모든 Event 해석을 바꾸는 이유이기도 하다.

System Common, SysEx, Meta Event가 Running Status를 어떻게 종료하는지도 명확히 해야 한다. 현재 구현은 새 Status Byte라면 모두 `previousStatus`에 저장한다. System Event 이후의 규칙까지 확인하는 호환성 fixture가 필요하다.

## [sort1] 4. Note On과 Note Off를 하나의 Note로 조립했다

도메인 모델은 Note의 시작 Tick과 길이를 원한다. 파일은 시작과 종료 Event를 따로 제공한다. Parser는 현재 눌려 있는 Note를 Map에 저장한다.

```ts
interface ActiveNote {
  pitch: number;
  velocity: number;
  channel: number;
  startTick: number;
}

const activeNotes = new Map<string, ActiveNote>();
const noteKey = (channel: number, pitch: number) => `${channel}-${pitch}`;
```

Note On을 만나면 `channel-pitch` key로 시작점을 저장한다. Note Off를 만나면 현재 Tick과 시작 Tick의 차이를 `durationTicks`로 만든다.

Velocity가 0인 Note On은 Note Off와 같은 의미로 처리한다.

```ts
if (eventType === NOTE_ON && velocity === 0) {
  finishNote(channel, pitch, currentTick);
}
```

같은 channel과 pitch의 Note On이 다시 들어왔는데 이전 Note가 닫히지 않았다면 현재 구현은 이전 Note를 먼저 종료한다. Track 끝까지 Note Off가 없으면 End of Track Tick에서 남은 Note를 닫는다.

이 선택은 손상된 파일에서도 유한한 길이의 Note를 만들지만, 원본의 오류를 조용히 보정한다는 tradeoff가 있다. Import 경고를 별도로 제공하면 사용자가 원본 문제와 보정 결과를 구분할 수 있다.

## [sort1] 5. Meta Event와 Channel Event를 같은 Switch에서 분리했다

Status의 상위 4 bit는 Channel Event 종류, 하위 4 bit는 channel 번호를 나타낸다.

```ts
const eventType = statusByte & 0xf0;
const channel = statusByte & 0x0f;
```

현재 구현이 보존하는 주요 정보는 다음과 같다.

- Note On·Off
- Track Name Meta Event
- Tempo Meta Event
- Track 종료 위치

Aftertouch, Control Change, Pitch Bend, Program Change, Channel Pressure는 Event 길이만큼 offset을 이동하지만 도메인 객체로 저장하지 않는다. SysEx도 길이를 읽고 건너뛴다.

따라서 정확한 표현은 “Note 중심 MIDI Import”다. “모든 MIDI Event를 지원한다”는 설명과는 다르다. 특히 Tempo가 여러 번 바뀌는 파일은 전체 Tempo Map이 아니라 Track에서 확인한 Tempo 값만 반환하므로 가변 Tempo Import도 추가 설계가 필요하다.

## [sort1] 6. Writer는 절대 Tick을 다시 Delta Time으로 바꿨다

Writer에서는 각 Note를 Note On과 Note Off Event로 펼친다.

```ts
const events = notes.flatMap(note => [
  { tick: note.startTick, data: createNoteOn(note) },
  { tick: note.startTick + note.durationTicks, data: createNoteOff(note) },
]);

events.sort((left, right) => left.tick - right.tick);
```

정렬한 뒤 이전 Event Tick과의 차이를 VLQ로 기록한다.

```ts
let previousTick = 0;

for (const event of events) {
  const delta = event.tick - previousTick;
  bytes.push(...writeVlq(delta), ...event.data);
  previousTick = event.tick;
}
```

마지막에는 Delta Time 0과 End of Track Meta Event를 추가하고, 전체 길이를 `MTrk` Chunk Header에 기록한다.

```mermaid
flowchart LR
  A["Note 배열"] --> B["Note On과 Off로 분해"]
  B --> C["절대 Tick 정렬"]
  C --> D["Delta Time 계산"]
  D --> E["VLQ 인코딩"]
  E --> F["MTrk Chunk 작성"]
```

## [sort1] 7. Binary Parser는 정상 입력보다 손상된 입력이 더 중요했다

현재 MIDI Parser와 Writer에는 자동 테스트가 없다. 최소 검증 세트는 다음과 같다.

- VLQ의 1·2·3·4 Byte 경계값 왕복
- Running Status가 있는 Note 연속 입력
- Velocity 0 Note On
- Note Off가 없는 Track 종료
- 여러 Track을 가진 Format 1 파일
- PPQN과 SMPTE division Header
- Meta·SysEx 이후 offset과 Running Status
- Parser→Writer→Parser Note 왕복
- 서로 다른 DAW에서 생성한 fixture와 결과 비교

Binary parser에서는 예상하지 못한 Event를 만났을 때 최소 한 Byte 이상 이동하거나 명시적으로 실패해야 한다. 알 수 없는 Event에서 offset이 그대로면 반복문이 끝나지 않을 수 있다.

## [sort1] 8. 포맷 구현은 Byte보다 지원 범위를 정의하는 일이었다

MIDI 파일을 직접 파싱하면서 가장 어려웠던 부분은 bit 연산이 아니었다. 어떤 Event를 도메인에 보존하고, 어떤 Event를 건너뛰며, 손상된 Note를 어떻게 닫을지 정책을 결정하는 일이 더 어려웠다.

> “Parser가 파일을 끝까지 읽었다는 사실은 정보를 보존했다는 뜻이 아니다.”

현재 구현은 Note 중심 Import와 Export의 기반을 제공한다. 다음 단계는 Running Status 경계와 가변 Tempo를 fixture로 고정하고, 버려지는 Event를 Import 결과에 명시하는 것이다.

## 참고

**표준·공식 자료**

- [MIDI Association, Standard MIDI Files](https://midi.org/standard-midi-files)

**한국어 블로그**

- [MIDI 포맷에 대해 알아보자](https://pubul.tistory.com/108)

**해외 블로그**

- [Standard MIDI file format, updated](https://midimusic.github.io/tech/midispec.html)
