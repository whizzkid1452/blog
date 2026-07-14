---
title: '[Part 4.] 흩어진 Undo/Redo를 Main History로 통합하기'
description: '실행 객체에 묶인 Undo/Redo를 직렬화 가능한 문서 patch와 Renderer runtime 동기화로 분리합니다.'
date: '2026-07-14'
publishedAt: '2026-07-14T09:30:00+09:00'
tags: ['electron', 'undo-redo', 'state-management', 'typescript']
draft: false
---

<details>
<summary>목차 펼쳐보기</summary>

- [1. 들어가며](#1-들어가며)
- [2. 기존 History의 한계](#2-기존-history의-한계)
  - [2-1. 기능별 History](#2-1-기능별-history)
  - [2-2. live 객체 의존](#2-2-live-객체-의존)
- [3. 문서 상태와 실행 상태 분리](#3-문서-상태와-실행-상태-분리)
  - [3-1. Main이 복원하는 값](#3-1-main이-복원하는-값)
  - [3-2. Renderer가 복원하는 값](#3-2-renderer가-복원하는-값)
- [4. History가 기억할 값](#4-history가-기억할-값)
- [5. Undo와 Redo 흐름](#5-undo와-redo-흐름)
  - [5-1. 기본 규칙](#5-1-기본-규칙)
  - [5-2. action group](#5-2-action-group)
- [6. Runtime 동기화](#6-runtime-동기화)
  - [6-1. 증분 반영](#6-1-증분-반영)
  - [6-2. 실패 시 복구](#6-2-실패-시-복구)
- [7. History와 asset 수명주기](#7-history와-asset-수명주기)
- [8. 마치며](#8-마치며)

</details>

<details>
<summary>시리즈 전체 글 바로가기</summary>

1. [Part 0. Main Process SSOT 시리즈를 시작하며](/posts/electron-main-process-ssot-series-guide)
2. [Part 1. Electron 멀티 윈도우에서 저장 결과가 달라진 이유](/posts/electron-multi-window-state-ssot)
3. [Part 2. Main Process에 ProjectDocument SSOT를 둔 이유](/posts/electron-main-process-project-ssot)
4. [Part 3. Renderer가 Main의 확정 상태를 받는 방법](/posts/electron-main-process-renderer-sync)
5. [Part 4. 흩어진 Undo/Redo를 Main History로 통합하기](/posts/electron-main-process-undo-redo)
6. [Part 5. 자동저장의 책임과 디스크 저장 보장](/posts/electron-main-process-autosave)
7. [Part 6. Main SSOT 설계를 검증하고 선택의 비용 정리하기](/posts/electron-main-process-migration)

</details>

[이전 글: Part 3. Renderer가 Main의 확정 상태를 받는 방법](/posts/electron-main-process-renderer-sync)

## 1. 들어가며

프로젝트 문서의 SSOT를 Main에 둔다고 기존 Undo/Redo를 그대로 옮길 수는 없었다. 기존 action은 Renderer의 `Session`, Timeline `Region`, `AudioBuffer` 같은 실행 객체를 직접 가지고 있었다. 이 객체는 프로젝트 파일에 저장할 수 없고 Electron IPC로 그대로 보낼 수도 없다.

결론부터 적으면, **Main History는 `ProjectDocument`의 forward patch와 inverse patch만 기억하고 Renderer의 동기화 계층이 같은 결과를 AudioEngine에 반영하도록 분리했다**.

## 2. 기존 History의 한계

### 2-1. 기능별 History

SRT와 Timeline과 Audio 편집 기능은 각각 별도의 History를 가지고 있었다. 한 사용자 동작이 SRT row와 Timeline region을 함께 바꾸면 어느 History를 먼저 되돌려야 하는지 분명하지 않았다.

### 2-2. live 객체 의존

기존 action은 현재 Renderer memory의 `Session`, Timeline `Region`, `AudioBuffer` 인스턴스를 직접 참조했다. 이런 실행 객체를 Main에 보내서 같은 의미로 복원할 수 있다고 가정할 수 없다. Electron `ipcRenderer` 문서는 IPC 인자가 Structured Clone Algorithm으로 직렬화되며 함수와 DOM 객체 등 일부 값은 복제할 수 없다고 설명한다. [Electron ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer)

따라서 기존 action 객체를 Main에 전송하는 방식은 제외했다.

## 3. 문서 상태와 실행 상태 분리

Undo/Redo가 복원할 값을 두 층으로 나누었다.

### 3-1. Main이 복원하는 값

- SRT text와 time range
- Timeline item의 위치와 길이
- track 배치
- asset 참조
- 프로젝트 설정

모두 `ProjectDocument`에 들어가는 직렬화 가능한 값이다.

### 3-2. Renderer가 복원하는 값

- AudioEngine의 region 인스턴스
- `AudioBuffer`
- waveform cache
- 현재 selection과 focus

문서 변경의 최종 기준은 Main이다. Renderer 실행 객체는 Main update를 받아 같은 결과가 되도록 갱신한다. selection처럼 프로젝트 결과에 포함되지 않는 UI state는 별도 정책으로 유지하거나 초기화한다.

## 4. History가 기억할 값

Main History의 한 항목은 다음 정보를 기억한다.

- 어떤 사용자 동작인지 나타내는 이름
- Redo 때 적용할 forward patch
- Undo 때 적용할 inverse patch

patch는 범용 문자열 path보다 프로젝트 변경 종류가 드러나는 형태로 구분한다. 변경 종류가 늘어날 때마다 정의를 추가해야 하지만, 어떤 값이 되돌아가는지 확인하기 쉽고 잘못된 path를 줄일 수 있다.

## 5. Undo와 Redo 흐름

### 5-1. 기본 규칙

1. 일반 action을 적용한다.
2. forward patch와 inverse patch를 한 entry로 Undo stack에 넣는다.
3. 새 일반 action이 들어오면 Redo stack을 비운다.
4. Undo는 inverse patch를 적용하고 entry를 Redo stack으로 옮긴다.
5. Redo는 forward patch를 적용하고 entry를 Undo stack으로 옮긴다.
6. Undo와 Redo도 새 project version을 만든다.
7. 결과를 모든 Renderer에 발행하고 자동저장을 요청한다.

```mermaid
sequenceDiagram
  participant R as "Renderer"
  participant S as "Main ProjectSession"
  participant H as "Main History"
  participant V as "열린 모든 Renderer"

  R->>S: "undo()"
  S->>H: "마지막 entry 꺼내기"
  H-->>S: "inversePatch"
  S->>S: "patch 적용과 version 증가"
  S-->>V: "확정된 Undo update"
  S->>H: "entry를 Redo stack으로 이동"
```

Undo를 실행한 창만 바꾸지 않는다. Main 문서의 확정 결과가 바뀌었으므로 모든 열린 창이 같은 update를 받는다.

### 5-2. action group

pointer move 100회는 사용자가 의도한 Undo 100회가 아니다. drag 시작 시 이전값을 기록하고 drag 종료 시 최종값과 함께 한 entry를 만든다.

Split처럼 여러 item을 함께 바꾸는 동작도 하나의 action group으로 처리한다. 중간 patch 일부만 History에 들어가면 Undo 후 불완전한 문서가 될 수 있다.

## 6. Runtime 동기화

Renderer 동기화 계층은 Main patch를 AudioEngine에 반영한다.

```mermaid
flowchart LR
  Update["Main ProjectUpdateResult"] --> Cache["ProjectSnapshot Cache"]
  Update --> Adapter["Renderer runtime 동기화"]
  Adapter --> Region["Timeline Region"]
  Adapter --> Audio["AudioEngine"]
  Adapter --> Buffer["AssetRef로 AudioBuffer 읽기"]
```

### 6-1. 증분 반영

일반적으로 patch에 포함된 item만 추가하거나 수정하거나 제거한다. 매 key 입력마다 AudioEngine 전체를 다시 만들면 비용이 커질 수 있기 때문이다.

### 6-2. 실패 시 복구

증분 반영이 실패하거나 Renderer의 현재 runtime version이 Main version과 맞지 않으면 다음 순서를 사용한다.

1. Main의 전체 snapshot을 다시 받는다.
2. 현재 AudioEngine runtime을 정리한다.
3. `AssetRef`를 기준으로 필요한 media를 다시 읽는다.
4. snapshot으로 runtime을 다시 만든다.

이 fallback은 느릴 수 있지만 불일치 상태를 계속 유지하는 것보다 안전하다. 실제 허용 시간은 대표 프로젝트로 측정해야 한다.

## 7. History와 asset 수명주기

Undo가 참조하는 asset을 현재 문서에서 사라졌다는 이유로 바로 지울 수 없다. Undo 후 다시 필요할 수 있기 때문이다.

초기 정책은 다음과 같다.

1. 현재 문서 또는 Undo/Redo History가 참조하는 asset은 유지한다.
2. History 길이에 상한을 둔다.
3. 오래된 History를 제거한 뒤 어느 곳에서도 참조하지 않는 asset을 정리한다.
4. asset 정리는 편집 action과 분리된 낮은 우선순위 작업으로 실행한다.

참조 횟수를 매번 관리하는 방법은 빠르지만 누락되면 잘못 삭제할 위험이 있다. 전체 참조를 다시 계산하는 방법은 단순하지만 프로젝트가 클수록 비용이 든다. 초기에는 안전한 전체 확인을 사용하고 측정 후 바꾼다.

앱을 다시 실행한 뒤 History까지 복원할지는 아직 미정이다. 복원한다면 asset 보존 기간과 History 파일 포맷도 함께 정해야 한다.

## 8. 마치며

Undo/Redo 통합에서 가장 어려운 부분은 stack 자료구조가 아니었다. 프로젝트 파일에 들어갈 값과 현재 Renderer에서 실행 중인 객체를 구분하는 일이었다.

Main은 문서의 이전값과 다음값을 기억한다. Renderer는 그 결과로 AudioEngine을 맞춘다. 이 경계가 생기면 저장과 Undo/Redo가 같은 `ProjectDocument`를 보게 된다. 다음 글에서는 이 문서를 언제 어떻게 디스크에 저장할지 정리한다.

[다음 글: Part 5. 자동저장의 책임과 디스크 저장 보장](/posts/electron-main-process-autosave)

---

## 참고

**Electron 공식 문서**

- [ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer)
- [Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
