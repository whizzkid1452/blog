---
title: 'Electron에서는 공유 데이터를 어디에 둬야 할까?'
description: '멀티 윈도우 환경에서 오래된 Renderer 상태가 최신 작업을 덮어쓴 원인을 분석하고, Main Process의 ProjectSession을 공유 데이터의 SSOT로 재설계한 과정을 정리합니다.'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00+09:00'
tags: ['electron', 'state-management', 'zustand', 'ssot', 'autosave']
draft: false
---

# Electron에서는 공유 데이터를 어디에 둬야 할까?

## 오래된 Renderer 상태가 최신 작업을 덮어쓴 원인과 Main Process를 SSOT로 설계한 과정

`#electron` `#state-management` `#zustand` `#ssot` `#autosave`

> **요약**  
> Electron 멀티 윈도우 환경에서 각 Renderer가 프로젝트 데이터의 복사본을 독립적으로 관리하면서, 오래된 Snapshot이 자동 저장을 통해 최신 작업을 덮어쓰는 문제가 발생했습니다. 이 글에서는 원인을 추적한 과정과 Main Process의 `ProjectSession`을 공유 데이터의 SSOT로 두고, Renderer Cache와 영속 저장소의 역할을 분리한 설계를 설명합니다.

## 목차

---

## 1. 문제 상황: 자동 저장 이후 최신 스크립트가 사라졌다

Electron으로 SRT 스크립트와 음성을 함께 편집하는 멀티미디어 에디터를 개발했습니다. 애플리케이션에는 Editor와 Admin 페이지가 있었고, SRT Script Panel은 별도 창으로 분리할 수 있었습니다. 사용자는 Editor와 SRT Panel을 동시에 열어 둔 채 스크립트를 수정할 수 있었습니다.

![동일 프로젝트를 편집하는 Editor와 분리된 SRT Script Panel](/images/electron-multi-window-shared-data-ssot/editor-srt-panel-browserwindows.png)

_BrowserWindow로 실행되는 Editor와 SRT Script Panel_

프로젝트에는 자동 저장 기능도 적용되어 있었습니다. 사용자가 저장 버튼을 누르지 않아도 변경된 프로젝트 데이터를 로컬 PC에 계속 기록하는 방식이었습니다.

그러던 중 다음과 같은 제보가 들어왔습니다.

> “스크립트를 수정하고 점심을 먹고 오니까 수정한 내용이 사라졌어요!”

수정 직후에는 SRT Panel에 최신 문장이 정상적으로 표시됐습니다. 그러나 프로젝트를 다시 확인하면 스크립트가 수정 전 내용으로 돌아가 있었습니다.

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/unexpected-reaction-meme.jpg" alt="별로 놀랄 일도 아닌 일에 어라고 말하지 말라는 개발자 밈" /></p>

_로그를 열기 전까지는 아무도 “어?”라고 하지 않기로 했습니다._

저장 요청 자체가 누락됐다면 마지막으로 저장된 값이 남아 있어야 합니다. 하지만 이번 문제에서는 이미 반영된 최신 내용이 과거 데이터로 되돌아가고 있었습니다.

로그를 확인한 결과 자동 저장은 중단되거나 실패하지 않았습니다. 문제는 다른 화면에 남아 있던 수정 전 데이터가 자동 저장되면서, 사용자가 방금 수정한 최신 내용을 덮어썼다는 점이었습니다.

```text
SRT Panel에서 스크립트 수정
        ↓
SRT Panel에는 최신 값이 표시됨
        ↓
다른 화면에는 수정 전 값이 남아 있음
        ↓
수정 전 값을 기준으로 자동 저장 실행
        ↓
로컬 프로젝트 파일이 이전 내용으로 덮어써짐
        ↓
프로젝트를 다시 불러오며 화면도 이전 상태로 돌아감
```

![오래된 Renderer Snapshot이 최신 스크립트를 덮어쓰는 순서](/images/electron-multi-window-shared-data-ssot/stale-snapshot-overwrite-sequence.png)

_오래된 Renderer Snapshot이 로컬 파일을 덮어쓰는 흐름_

이 문제는 단순한 화면 갱신 오류가 아니었습니다. 사용자가 작성한 결과가 이전 데이터로 덮어써지는 실제 데이터 유실 문제였습니다.

---

## 2. 원인 분석: 저장 실패가 아니라 오래된 Snapshot의 저장이었다

당시 같은 프로젝트 데이터를 사용하는 기능은 크게 네 가지였습니다.

| 기능               | 사용하는 데이터             |
| ------------------ | --------------------------- |
| 프로젝트 자동 저장 | 현재 프로젝트 전체 데이터   |
| SRT Script Panel   | 실시간으로 변경되는 SRT Row |
| Editor             | SRT와 연결된 편집 데이터    |
| Admin              | 현재 프로젝트와 SRT 데이터  |

각 화면은 자신이 사용하는 Store에 프로젝트 데이터의 복사본을 가지고 있었습니다.

```text
SRT Panel Renderer
└─ Project Store A

Editor Renderer
└─ Project Store B

Admin Renderer
└─ Project Store C

Local Project File
└─ Project Snapshot D
```

SRT Panel에서 스크립트를 수정하면 `Store A`에는 최신 값이 반영됐습니다. 반면 Editor와 Admin이 사용하는 `Store B`, `Store C`에는 수정 전 값이 남아 있을 수 있었습니다.

```text
SRT Panel Store
└─ “수정한 스크립트”

Editor Store
└─ “수정 전 스크립트”

Admin Store
└─ “수정 전 스크립트”
```

이 상태에서 Editor나 Admin의 데이터를 기준으로 자동 저장이 실행되면 로컬 프로젝트 파일에는 이전 내용이 기록됩니다.

```text
사용자가 수정한 값
└─ “안녕하세요. 수정된 스크립트입니다.”

다른 Renderer에 남아 있던 값
└─ “안녕하세요.”

자동 저장된 프로젝트 파일
└─ “안녕하세요.”
```

파일 I/O는 전달받은 값을 정상적으로 기록하고 있었습니다. 잘못된 것은 저장 동작이 아니라 저장 함수에 전달된 데이터였습니다.

즉, 디버깅의 초점은 다음 두 가지로 바뀌었습니다.

- 어떤 Renderer가 저장을 요청했는가
- 그 요청에는 어느 시점의 Snapshot이 포함돼 있었는가

처음에는 화면 간 동기화 코드가 일부 누락된 문제라고 생각했습니다. SRT Panel이 변경될 때 Editor Store를 갱신하고, Editor가 변경될 때 Admin Store를 갱신하면 해결할 수 있어 보였습니다.

```text
SRT Panel이 바뀌면 Editor를 갱신한다.
Editor가 바뀌면 Admin을 갱신한다.
Admin이 바뀌면 SRT Panel을 갱신한다.
```

하지만 이 방식은 Store 간 복사 경로만 늘릴 뿐, 값이 서로 다를 때 무엇을 최신으로 판단할지 정하지 못합니다.

```text
SRT Panel ─────→ Editor
     │             │
     ↓             ↓
   Admin ←────── Studio
```

창이나 화면이 추가될 때마다 동기화 경로도 함께 늘어납니다. 이벤트가 한 번이라도 누락되면 Store들은 다시 서로 다른 Snapshot을 갖게 됩니다. 여러 변경이 연속으로 발생하면 메시지 도착 순서와 저장 순서에 따라 결과가 달라질 수도 있습니다.

당시 구조의 핵심 문제는 명확했습니다.

> 같은 데이터를 여러 Store가 독립적으로 소유하고 있었지만, 어느 값이 최신인지 결정하는 기준이 없었습니다.

따라서 해결해야 할 질문은 자동 저장 주기나 호출 횟수가 아니었습니다.

> 여러 창이 같은 데이터를 사용할 때, 누가 최종 상태를 확정해야 하는가?

---

## 3. Electron 멀티 윈도우에서 Store가 분리되는 이유

일반적인 React 애플리케이션에서는 Zustand나 Redux Store 하나를 만들고 여러 컴포넌트가 같은 값을 구독할 수 있습니다. 그래서 처음에는 Electron에서도 같은 Store 모듈을 import하면 하나의 상태를 공유할 수 있다고 생각했습니다.

```ts
import { useProjectStore } from './projectStore';
```

하지만 Electron 멀티 윈도우 환경에서는 전역의 범위가 다릅니다.

Electron 애플리케이션에는 Main Process와 Renderer Process가 있습니다. Main Process는 애플리케이션 진입점과 창의 생명주기를 관리하고, 각 `BrowserWindow`는 별도의 Renderer Process에서 웹 페이지를 실행합니다. 각 Renderer는 독립된 JavaScript 실행 환경과 메모리를 사용합니다. ([Electron](https://electronjs.org/docs/latest/tutorial/process-model 'Process Model'))

```text
Main Process
 ├─ Editor Window
 │    └─ Renderer Process A
 │         └─ Project Store A
 │
 └─ SRT Panel Window
      └─ Renderer Process B
           └─ Project Store B
```

같은 Store 모듈을 import했다는 것은 같은 코드로 Store를 생성했다는 뜻입니다. 동일한 Store 인스턴스를 공유한다는 뜻은 아닙니다.

```text
Renderer A의 projectStore
≠
Renderer B의 projectStore
```

React 애플리케이션에서 말하는 전역 Store는 하나의 JavaScript 실행 환경 안에서만 전역입니다. Electron에서는 창마다 Renderer Process와 메모리가 분리되므로, Renderer 내부 Store를 애플리케이션 전체의 전역 Store로 사용할 수 없습니다.

```text
창이 분리된다.
    ↓
Renderer Process가 분리된다.
    ↓
Store 인스턴스도 분리된다.
    ↓
각 Store가 서로 다른 Snapshot을 가진다.
    ↓
오래된 Snapshot이 자동 저장될 수 있다.
```

![여러 Renderer Store와 Electron 프로세스 경계를 보여주는 AS-IS 구조](/images/electron-multi-window-shared-data-ssot/as-is-renderer-stores.png)

_변경 전 Store 인스턴스와 프로세스 경계_

이 글의 구조도에서는 데이터 흐름을 단순하게 표현하기 위해 Main과 Renderer 사이의 Preload Script를 생략했습니다. 실제 구현에서는 Renderer에 Electron API 전체를 노출하지 않고, Preload Script와 `contextBridge`를 통해 필요한 기능만 제한적으로 제공했습니다. Electron 공식 문서도 이러한 IPC 노출 방식을 안내합니다. ([Electron](https://electronjs.org/docs/latest/tutorial/ipc 'Inter-Process Communication'))

또한 일반적인 `ipcMain`과 `ipcRenderer`만으로 Renderer끼리 직접 메시지를 보내는 API는 제공되지 않습니다. Renderer 간 데이터 전달에는 Main Process를 중계자로 사용하거나, Main에서 MessagePort를 생성해 각 Renderer에 전달하는 방식이 필요합니다. ([Electron](https://electronjs.org/docs/latest/tutorial/ipc 'Inter-Process Communication'))

---

## 4. 공유 데이터가 충족해야 할 조건

공유 데이터의 위치를 정하기 전에, 어떤 기능이 같은 데이터를 사용하고 어떤 규칙을 지켜야 하는지 정리했습니다.

### 프로젝트 자동 저장

현재 프로젝트 정보를 사용자의 로컬 PC에 저장합니다.

### SRT Script Panel

SRT Row를 실시간으로 수정합니다. 별도 창으로 분리할 수 있으므로 다른 페이지와 동시에 열릴 수 있습니다.

### Editor

SRT 데이터와 연결된 편집 정보를 사용합니다. SRT Panel에서 데이터가 변경되면 현재 열려 있는 Editor에도 반영돼야 합니다.

### Admin

현재 프로젝트와 SRT 데이터를 조회하거나 수정합니다. Admin으로 이동했을 때도 최신 데이터가 표시돼야 합니다.

화면과 저장에는 다음과 같은 제약도 있었습니다.

- Editor와 Studio 페이지는 동시에 사용할 수 없습니다.
- SRT Panel은 별도 창으로 분리할 수 있으며 Editor 또는 Admin과 함께 열릴 수 있습니다.
- 변경된 프로젝트 데이터는 로컬 PC에 자동 저장해야 합니다.
- 특정 창을 닫더라도 현재 프로젝트 데이터는 유지돼야 합니다.
- 새로 열린 창이나 나중에 활성화된 화면도 최신 데이터를 확인할 수 있어야 합니다.

정리하면 공유 데이터는 다음 조건을 충족해야 했습니다.

```text
여러 창이 함께 사용한다.
        +
실시간으로 변경된다.
        +
열려 있는 관련 화면에 반영돼야 한다.
        +
로컬 프로젝트 파일에 저장돼야 한다.
        +
특정 창을 닫아도 유지돼야 한다.
```

이 조건을 기준으로 보면 문제는 Store 간 동기화보다 데이터 소유권에 가까웠습니다. 먼저 최신 값을 확정할 주체를 정한 뒤, 각 화면과 저장소가 그 값을 어떻게 전달받을지 설계해야 했습니다.

---

## 5. 검토한 대안과 한계

### 대안 1. Renderer Store끼리 직접 동기화한다

첫 번째로 검토한 방법은 각 Renderer Store를 서로 동기화하는 방식이었습니다. SRT Panel에서 스크립트가 변경되면 Editor와 Admin의 Store에도 같은 값을 전달합니다.

```text
SRT Panel Store 변경
        ↓
Editor Store 갱신
        ↓
Admin Store 갱신
```

열려 있는 화면이 적고 동기화 방향이 단순하다면 구현할 수 있습니다. 그러나 화면마다 다른 화면의 존재와 이벤트를 알아야 한다는 문제가 있습니다.

- SRT Panel은 Editor와 Admin을 알아야 합니다.
- Editor는 SRT Panel과 Admin을 알아야 합니다.
- 새로운 화면이 추가되면 기존 동기화 코드도 수정해야 합니다.
- 이벤트가 한 번 누락되면 Store가 다시 어긋납니다.
- 동시에 여러 변경이 발생하면 어느 값이 최신인지 판단하기 어렵습니다.

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/temporary-fix-meme.jpg" alt="코드의 오류를 손바닥으로 막고 있는 임시방편을 표현한 밈" /></p>

_동기화가 누락될 때마다 IPC 하나씩 추가하던 시절._

누락된 경로마다 IPC를 추가하는 방식으로는 이 문제에서 손을 뗄 수 없었습니다. Renderer 간 동기화 자체는 필요하지만, 동기화보다 먼저 모든 Renderer가 따라야 할 기준점이 필요했습니다.

### 대안 2. Local Project File을 기준으로 삼는다

두 번째로 로컬 프로젝트 파일을 SSOT로 사용하는 방법을 검토했습니다.

```text
Renderer에서 변경
       ↓
로컬 파일에 저장
       ↓
다른 Renderer가 파일 다시 읽기
       ↓
화면 갱신
```

하나의 파일을 기준으로 값을 맞출 수 있다는 장점은 있습니다. 하지만 로컬 파일은 영속 데이터 보관에는 적합해도, 실행 중인 실시간 상태를 조정하는 주체로 사용하기에는 한계가 있었습니다.

- 연속된 입력마다 파일 읽기와 쓰기가 발생합니다.
- 여러 저장 요청의 실행 순서를 별도로 보장해야 합니다.
- 파일 쓰기가 끝나기 전에 다시 읽으면 이전 데이터가 반환될 수 있습니다.
- Renderer마다 파일을 읽는 시점이 달라 서로 다른 값을 볼 수 있습니다.
- 파일 시스템이 저장소와 상태 동기화 채널의 책임을 동시에 갖게 됩니다.

무엇보다 이번 문제는 오래된 Snapshot이 파일에 저장되면서 발생했습니다. 파일을 기준으로 삼더라도 어떤 Snapshot을 기록할지는 다른 주체가 결정해야 합니다.

따라서 로컬 프로젝트 파일은 영속 저장소로 역할을 제한했습니다.

```text
실행 중인 최신 데이터
└─ 메모리의 ProjectSession

앱 종료 후에도 보존할 데이터
└─ Local Project File
```

---

## 6. Main Process에 SSOT를 둔 이유

대안을 검토하면서 질문을 다음과 같이 바꿨습니다.

> 변경 내용을 어느 화면에 더 전달할지가 아니라, 어느 프로세스가 원본을 소유해야 하는가?

우리 애플리케이션에서 프로젝트 파일 저장은 이미 Main Process가 담당하고 있었습니다. Renderer에서 변경된 프로젝트 데이터를 저장하려면 Main으로 요청을 보내야 했습니다.

```text
Renderer에서 변경
       ↓
Main Process
       ↓
Local Project File
```

다른 Renderer에 변경 내용을 전달할 때도 Main Process가 각 창에 메시지를 보낼 수 있습니다. 또한 Main Process는 특정 화면의 생명주기에 종속되지 않습니다.

```text
Editor 창 종료
    ↓
Editor Renderer 종료

Main Process
    ↓
ProjectSession 유지
```

Editor가 닫혀도 Main Process의 현재 프로젝트 데이터는 유지할 수 있습니다. 이후 Admin이나 SRT Panel이 열리면 현재 Snapshot을 다시 전달할 수 있습니다.

이러한 이유로 실행 중인 공유 데이터의 SSOT를 Main Process에 두기로 했습니다.

![Main Process의 ProjectSession을 SSOT로 둔 TO-BE 구조](/images/electron-multi-window-shared-data-ssot/to-be-project-document-service.png)

_Main Process의 ProjectSession을 SSOT로 둔 구조_

다만 모든 상태를 Main Process에서 관리한 것은 아닙니다. 다음 조건에 해당하는 데이터만 Main의 공유 상태로 관리했습니다.

- 여러 Renderer가 함께 사용합니다.
- 로컬 프로젝트 파일에 저장돼야 합니다.
- 특정 창이 닫혀도 유지돼야 합니다.
- 화면에서 보는 최신 값과 저장되는 값이 일치해야 합니다.

Modal, Hover, 검색어처럼 특정 화면에서만 사용하는 상태는 계속 각 Renderer에서 관리했습니다.

### SSOT의 의미

Renderer가 화면을 렌더링하려면 로컬 상태가 필요합니다. 따라서 Main Process에 단일 진실 공급원(Single Source of Truth, SSOT)을 두기로 정했다고 해서 Renderer에 프로젝트 데이터가 없어야 하는 것은 아닙니다.

이번 구조에서 SSOT는 다음과 같이 정의했습니다.

> 데이터 복사본이 물리적으로 하나뿐이라는 뜻이 아니라, 값이 서로 다를 때 무엇을 기준으로 맞출지 결정하는 주체가 하나라는 뜻입니다.

Renderer에는 화면 렌더링을 위한 복사본이 존재할 수 있습니다. 다만 Main과 Renderer의 값이 다르면 Main의 Snapshot을 기준으로 맞추며, 프로젝트 데이터 변경도 Main에서 최종 확정합니다.

| 위치                  | 역할                                           |
| --------------------- | ---------------------------------------------- |
| Main `ProjectSession` | 최신 Snapshot 결정, 변경 규칙과 version 적용   |
| Renderer Cache        | 화면을 렌더링하기 위한 읽기 전용 로컬 복사본   |
| Local Project File    | 앱 종료 이후에도 데이터를 유지하는 영속 저장소 |

---

## 7. ProjectSession 설계

SSOT의 위치를 정한 뒤에는 Main Process에서 현재 프로젝트 Snapshot을 어떤 형태로 관리할지 결정해야 했습니다.

Main Process에는 React 컴포넌트 트리가 없으므로 `useState`나 React Context처럼 렌더링을 전제로 하는 도구를 그대로 사용할 수 없습니다. Plain Object, Class private field, Vanilla Zustand를 검토했습니다.

### Plain Object

현재 Snapshot 보관만 필요하다면 일반 객체로도 충분합니다.

```ts
let currentProject: ProjectSnapshot = initialProjectSnapshot;
```

하지만 이번 구조에는 값 보관 외에도 다음 규칙이 필요했습니다.

- 현재 Snapshot 조회
- 변경 요청 검증과 적용
- project version 증가
- Undo/Redo History 기록
- 확정된 변경 결과 발행
- 외부 코드의 직접 변경 방지

Plain Object만으로도 구현할 수 있지만, 외부 코드가 값을 직접 바꾸지 못하게 제한하고 모든 변경 규칙을 한 경로로 모으려면 별도의 API 경계가 필요했습니다.

### Class

Class를 사용하면 외부에 허용할 변경 메서드만 공개할 수 있습니다.

```ts
projectSession.dispatch(action);
projectSession.undo();
projectSession.redo();
```

프로젝트 Snapshot은 private field로 감추고, 변경 검증과 version 증가를 공개 메서드 안에서 함께 처리할 수 있습니다.

### Vanilla Zustand

Zustand의 `createStore`는 React 없이 사용할 수 있는 Vanilla Store를 만듭니다. 생성된 Store는 `getState`, `setState`, `subscribe` API를 제공하므로 Snapshot 보관과 구독이 필요한 경우 사용할 수 있습니다. ([Zustand](https://zustand.docs.pmnd.rs/reference/apis/create-store 'createStore - Zustand'))

다만 Main에서 필요했던 기능은 `ProjectSession`의 private field와 method만으로 구현할 수 있었습니다.

| 기준           | Class private field | Vanilla Zustand                    |
| -------------- | ------------------- | ---------------------------------- |
| 외부 변경 차단 | private로 제한      | Store API 노출 범위를 별도로 제한  |
| Selector 구독  | 직접 구현           | Store API로 제공                   |
| Middleware     | 직접 구현           | 생태계를 활용할 수 있음            |
| 현재 요구사항  | 충분함              | `ProjectSession` API와 기능이 겹침 |

따라서 초기 구조에서는 Vanilla Zustand를 Main의 저장소로 추가하지 않고, `ProjectSession`의 private field에 Snapshot을 보관했습니다. Main 내부에서 여러 모듈이 서로 다른 Selector를 구독하거나 Middleware가 필요해질 때 Vanilla Zustand를 다시 비교할 수 있습니다.

`useSyncExternalStore`도 Main의 Snapshot 저장소를 만드는 API는 아닙니다. 이 Hook은 React 컴포넌트가 React 외부 Store의 값을 읽고 변경을 구독하도록 연결합니다. 이번 구조에서는 Renderer의 프로젝트 Snapshot을 TanStack Query Cache에 보관하므로 `useSyncExternalStore`를 직접 구현하지 않았습니다. ([React](https://react.dev/reference/react/useSyncExternalStore 'useSyncExternalStore'))

### ProjectSnapshot과 ProjectSession

Main Process에서 관리할 데이터는 크게 두 종류였습니다.

- 프로젝트 이름, 경로, 설정, 메타데이터처럼 자주 변경되지 않는 정보
- SRT Row, 스크립트 내용, 편집 결과처럼 실시간으로 변경되고 파일에 저장돼야 하는 정보

이 데이터를 하나의 `ProjectSnapshot`으로 관리했습니다.

```ts
type ProjectSnapshot = {
  version: number;
  projectInfo: ProjectInfo;
  scriptRows: SrtRow[];
};
```

`ProjectSession`은 현재 Snapshot을 보관하고, 외부에는 허용된 변경 API만 제공합니다. 핵심 책임만 남긴 예시는 다음과 같습니다.

```ts
class ProjectSession {
  private currentSnapshot: ProjectSnapshot;

  constructor(initialSnapshot: ProjectSnapshot) {
    this.currentSnapshot = structuredClone(initialSnapshot);
  }

  getSnapshot(): ProjectSnapshot {
    return structuredClone(this.currentSnapshot);
  }

  dispatch(action: ProjectAction): ProjectUpdateResult {
    const previousVersion = this.currentSnapshot.version;
    const nextDocument = applyProjectAction(this.currentSnapshot, action);

    // 변경 내용과 version을 같은 동기 작업 안에서 확정합니다.
    this.currentSnapshot = {
      ...nextDocument,
      version: previousVersion + 1,
    };

    return createUpdateResult({
      action,
      previousVersion,
      snapshot: this.getSnapshot(),
    });
  }
}
```

예시에서 `applyProjectAction`은 요청을 검증하고 새 문서를 만드는 순수 함수이며, `createUpdateResult`는 확정된 Snapshot과 version을 응답 형태로 조립합니다. 실제 변경 종류에 따라 forward patch와 inverse patch를 함께 만들어 Undo/Redo History에 기록할 수 있습니다.

저장과 Broadcast까지 `ProjectSession`이 직접 수행하게 하지는 않았습니다. Main 내부 책임은 다음과 같이 분리했습니다.

| 역할                    | 책임                                                   |
| ----------------------- | ------------------------------------------------------ |
| `ProjectSession`        | 변경 검증, document update, version, Undo/Redo History |
| Project Event Publisher | 열린 Renderer에 확정 결과 발행                         |
| Autosave Coordinator    | Debounce, pending Snapshot, 파일 쓰기 순서, `flush`    |
| Project Repository      | JSON 변환과 로컬 프로젝트 파일 교체                    |
| IPC Handler             | Preload에 노출할 API와 입력 검증 경계                  |

이 분리로 `ProjectSession`은 파일 형식이나 Renderer Cache를 알지 않고, Repository는 언제 무엇을 저장할지 결정하지 않습니다.

---

## 8. Renderer 동기화와 자동 저장 흐름

### Renderer는 변경을 요청하고 Main이 확정한다

기존에는 각 Renderer가 자신의 Store를 수정했고, 해당 Store의 값이 자동 저장에 사용될 수 있었습니다.

변경 후에는 Renderer가 프로젝트 데이터를 직접 확정하지 않습니다. Renderer는 사용자의 변경 의도를 `ProjectAction`으로 Main Process에 전달하고, Main이 요청을 검증한 뒤 Snapshot과 version을 확정합니다.

```text
SRT Renderer
    ↓ ProjectAction
Main IPC Handler
    ↓ dispatch
ProjectSession
    ├─ Snapshot과 version 확정
    ├─ Autosave Coordinator에 전달
    └─ 관련 Renderer에 확정 결과 발행
```

SRT Panel에서는 다음과 같이 변경을 요청합니다.

```ts
const updateResult = await window.project.dispatch({
  actionId: crypto.randomUUID(),
  baseVersion: projectSnapshot.version,
  type: 'srt-row-text-updated',
  payload: { rowId, text: nextText },
});
```

Main Process는 요청을 받아 `ProjectSession`을 변경합니다.

```ts
ipcMain.handle('project:dispatch', (_event, action: ProjectAction) => {
  const updateResult = projectSession.dispatch(action);
  const snapshot = projectSession.getSnapshot();

  projectEventPublisher.publish(updateResult);
  autosaveCoordinator.schedule(snapshot);

  return updateResult;
});
```

`baseVersion`은 Renderer가 어느 version을 보고 수정했는지 Main이 판단할 근거입니다. 현재 version과 다를 때 요청을 거절할지, 항목 단위 version으로 비교할지, 마지막으로 도착한 요청을 적용할지는 별도의 충돌 정책으로 정해야 합니다.

```text
Renderer의 변경 요청
        ↓
ProjectSession dispatch
        ↓
검증 · document update · version 증가
        ↓
확정된 ProjectUpdateResult
   ┌──────────┴───────────┐
   ↓                      ↓
Autosave Coordinator   Renderer Broadcast
```

![Renderer 변경 요청부터 Main 저장과 Broadcast까지의 순서](/images/electron-multi-window-shared-data-ssot/project-document-update-save-broadcast.png)

_Renderer 변경 요청부터 저장과 Broadcast까지의 흐름_

이제 자동 저장은 특정 Renderer의 Store를 기준으로 실행하지 않습니다. 항상 Main Process의 `ProjectSession`이 가진 Snapshot을 사용합니다.

### 자동 저장은 ProjectSession의 Snapshot만 사용한다

자동 저장 구조에서 가장 중요한 규칙은 다음과 같습니다.

> Renderer가 가진 프로젝트 데이터로 파일을 직접 저장하지 않습니다.

```text
기존

Renderer Store
    ↓
자동 저장


변경 후

Renderer
    ↓ 변경 요청
ProjectSession
    ↓ 최신 Snapshot 확정
자동 저장
```

사용자의 변경은 Main Process의 메모리 Snapshot에 즉시 반영합니다. 디스크 쓰기는 비동기로 처리하되, 이전 Snapshot의 저장이 나중에 완료되면서 최신 파일을 다시 덮어쓰지 않도록 프로젝트별 파일 쓰기를 순서대로 실행합니다.

```text
사용자 입력
    ↓
Main Snapshot 즉시 변경
    ↓
Debounce 동안 pending Snapshot을 최신 값으로 교체
    ↓
같은 프로젝트의 파일 쓰기를 하나씩 실행
```

예를 들어 version 10을 저장하는 동안 version 11, 12, 13이 들어오면 11과 12를 각각 파일로 만들 필요는 없습니다. 현재 쓰기가 끝난 뒤 저장하지 않은 최신 version 13을 기록하면 됩니다. 이것은 여러 Snapshot을 합치는 merge가 아니라, pending Snapshot 참조를 최신 값으로 교체하는 coalescing입니다.

파일 쓰기는 프로젝트별 queued sequential execution으로 제한했습니다. 이 순서 제어는 모든 document update에 적용하지 않습니다. 메모리의 Snapshot과 version은 즉시 확정하고, 같은 프로젝트 파일을 대상으로 한 비동기 쓰기만 앞선 작업이 끝난 뒤 시작합니다.

### Renderer Cache는 화면 렌더링에 사용한다

Main Process의 Snapshot이 변경되면 Renderer 화면도 갱신돼야 합니다. Renderer는 Main에서 확정 결과를 받고, 전달받은 Snapshot 또는 Patch를 TanStack Query Cache에 반영합니다.

```ts
function applyConfirmedSnapshot(incomingSnapshot: ProjectSnapshot): void {
  queryClient.setQueryData<ProjectSnapshot>(['project', incomingSnapshot.projectInfo.id], currentSnapshot => {
    if (currentSnapshot && incomingSnapshot.version <= currentSnapshot.version) {
      return currentSnapshot;
    }

    return incomingSnapshot;
  });
}
```

`setQueryData`는 이미 받은 확정 결과를 Cache에 동기적으로 반영할 때 사용합니다. 기존 Cache 객체를 직접 수정하지 않고 새 Snapshot을 반환합니다. ([TanStack Query](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata 'QueryClient.setQueryData'))

Main Process의 `ProjectSession`과 Renderer Cache는 역할이 다릅니다.

```text
Main ProjectSession
└─ 무엇이 최신인지 결정하는 SSOT

Renderer TanStack Query Cache
└─ 확정된 데이터를 화면에 표시하기 위한 읽기 전용 복사본
```

여기서 읽기 전용은 JavaScript 객체를 기술적으로 변경할 수 없다는 뜻이 아닙니다. UI가 Cache의 값을 프로젝트의 최종 상태로 확정하지 않고, 사용자 입력을 다시 Main에 요청한다는 API 규칙을 뜻합니다.

프로젝트 규모가 커져 전체 Snapshot을 매번 전달하는 비용이 부담된다면, 변경된 영역만 Patch로 전달하는 방식도 적용할 수 있습니다.

---

## 9. 늦게 열린 화면과 일시적인 UI 이벤트 처리

### 늦게 열린 화면은 현재 Snapshot을 다시 요청한다

현재 열려 있는 Renderer에는 Main Process가 변경된 Snapshot을 Broadcast하면 됩니다. 하지만 Admin 탭이 나중에 열리거나 Renderer가 새로 로드됐다면 이전에 발생한 Broadcast를 받을 수 없습니다.

```text
SRT 데이터 변경
    ↓
Editor와 SRT Panel은 Broadcast 수신
    ↓
이후 Admin 탭 진입
    ↓
Admin은 이전 Broadcast를 받지 못함
```

이때 로컬 프로젝트 파일을 다시 읽는 방식은 적절하지 않았습니다. Main Process의 Snapshot은 이미 최신 값으로 변경됐지만, 비동기 파일 저장은 아직 끝나지 않았을 수 있기 때문입니다.

```text
Main Process의 Snapshot
└─ 최신 값

저장 중인 Local Project File
└─ 이전 값
```

실행 중인 SSOT를 Main Process로 정했다면 화면 재검증도 Main을 기준으로 해야 합니다. 따라서 새 창이 열리거나 탭이 활성화될 때 `ProjectSession`의 현재 Snapshot을 다시 요청하도록 했습니다.

```ts
const snapshot = await window.project.getSnapshot();

applyConfirmedSnapshot(snapshot);
```

전체 흐름은 다음과 같습니다.

```text
현재 열려 있는 화면
└─ Main의 Broadcast로 갱신

새로 열린 창 또는 활성화된 탭
└─ Main의 현재 Snapshot 다시 요청
```

비동기 Snapshot 요청과 Broadcast의 도착 순서가 뒤바뀔 수 있으므로 `version`을 비교해 오래된 Snapshot이 최신 값을 덮어쓰지 못하도록 처리했습니다.

```text
현재 version이 12일 때

12 이하 수신  → 이미 적용했거나 오래된 결과이므로 무시
13 수신       → 다음 update이므로 적용
14 이상 수신  → 중간 event 누락으로 판단하고 Main Snapshot 재요청
```

이 규칙은 중복 전달, 순서 역전, event 누락을 구분합니다. 같은 SRT Row를 서로 다른 의도로 수정한 의미적 충돌까지 해결하지는 않으므로, 그 경우에는 `baseVersion`과 별도의 충돌 정책이 필요합니다.

### 저장하지 않는 이벤트는 별도 채널로 분리한다

프로젝트 데이터와 비슷해 보이지만 저장할 필요가 없는 이벤트도 있었습니다.

Editor에서 특정 Region을 클릭하면 SRT Panel에서 연결된 Script Row를 Highlight하고, 해당 위치까지 스크롤해야 했습니다.

```text
Editor에서 Region 클릭
        ↓
SRT Panel의 Row Highlight
        ↓
해당 Row 위치로 Scroll
```

이 이벤트는 창 사이에 전달돼야 하지만 프로젝트 데이터는 아닙니다. Region 선택과 Scroll 위치는 애플리케이션을 다시 실행했을 때 복원할 필요가 없는 일시적인 UI 상태입니다.

이 값을 `ProjectSession`에 포함하면 단순한 Row Highlight에도 프로젝트 Snapshot 변경과 파일 저장이 발생합니다.

```text
Region 클릭
    ↓
Project Snapshot 변경
    ↓
프로젝트 파일 저장
    ↓
모든 Renderer에 Snapshot Broadcast
```

따라서 데이터를 성격에 따라 세 종류로 구분했습니다.

| 데이터 종류           | 예시                              | 관리 위치                      | 파일 저장 |
| --------------------- | --------------------------------- | ------------------------------ | --------- |
| 저장되는 공유 데이터  | SRT Row, 프로젝트 정보, 편집 결과 | Main의 `ProjectSession`        | 필요      |
| Renderer 내부 상태    | Modal, Filter, Hover              | React State 또는 Zustand Store | 불필요    |
| 일시적인 창 간 이벤트 | Highlight, Scroll, Selection      | IPC 또는 MessagePort           | 불필요    |

단발성 이벤트는 일반 IPC로 전달할 수 있습니다. 지속적이거나 빈도가 높은 이벤트를 별도 채널로 분리해야 한다면 `MessageChannelMain`과 `MessagePortMain`을 사용할 수 있습니다. Main Process에서 연결된 Port 쌍을 생성해 각 Renderer에 전달하면 초기 연결 이후 지속적인 메시지 채널을 구성할 수 있습니다. ([Electron](https://electronjs.org/docs/latest/tutorial/message-ports 'MessagePorts in Electron'))

```text
Editor Renderer
      │
      │ Region Selected
      ▼
 MessagePort Channel
      │
      ▼
SRT Panel Renderer
      │
      ├─ Row Highlight
      └─ Scroll
```

Main Process는 채널 연결만 담당하고, 해당 이벤트를 프로젝트 Snapshot에는 저장하지 않습니다. 이 구분을 통해 `ProjectSession`이 모든 화면 상호작용을 처리하는 거대한 Event Bus로 확장되는 것을 방지했습니다.

---

## 10. 변경 전후 비교와 회고

### AS IS

```text
각 Renderer
└─ 프로젝트 데이터의 복사본을 독립적으로 관리

자동 저장
└─ 호출된 위치의 Store를 기준으로 실행
```

기존 구조에는 다음 문제가 있었습니다.

- 창마다 Store 인스턴스가 달랐습니다.
- 동일한 데이터에 여러 기준점이 존재했습니다.
- 사용자가 편집한 값과 자동 저장되는 값이 달라질 수 있었습니다.
- 오래된 Snapshot이 최신 작업을 덮어쓸 수 있었습니다.
- 새로 열린 화면은 이전 변경 이벤트를 받을 수 없었습니다.
- 저장되는 데이터와 일시적인 UI 이벤트가 같은 흐름에 섞여 있었습니다.

### TO BE

```text
Renderer
   ↓ ProjectAction
Main Process의 ProjectSession
   ├─ Snapshot과 version 확정
   ├─ Project Event Publisher → 관련 Renderer
   └─ Autosave Coordinator → Local Project File
```

변경 후에는 역할이 다음과 같이 정리됐습니다.

- Main Process의 `ProjectSession`이 공유 데이터의 최신 값을 결정합니다.
- Renderer는 프로젝트 데이터를 직접 확정하지 않고 Main에 변경을 요청합니다.
- 자동 저장은 항상 `ProjectSession`의 Snapshot을 기준으로 실행합니다.
- Main이 확정한 Snapshot을 관련 Renderer에 전달합니다.
- TanStack Query Cache는 화면 렌더링을 위한 읽기 전용 복사본으로 사용합니다.
- 새로운 창이나 탭은 진입 시 Main의 현재 Snapshot을 다시 요청합니다.
- 로컬 프로젝트 파일은 영속 저장과 앱 재실행 시 복구에 사용합니다.
- Highlight와 Scroll 같은 임시 이벤트는 별도 채널로 전달합니다.

최종적으로 데이터 흐름은 세 가지로 분리됐습니다.

```text
저장되는 공유 데이터
└─ Main Process의 ProjectSession

공유 데이터를 표시하는 Renderer Cache
└─ TanStack Query Cache

화면에만 필요한 UI 상태
└─ React State 또는 Zustand Store

저장되지 않는 임시 이벤트
└─ IPC 또는 MessagePort
```

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/hate-love-programming-meme.png" alt="프로그래밍을 싫어하다가 코드가 작동하면 다시 좋아하는 개발자 티셔츠 밈" /></p>

_역할을 분리한 뒤 자동 저장은 다시 사용자의 작업을 보호하는 기능이 됐습니다._

### 회고

처음에는 자동 저장 기능을 가장 먼저 의심했습니다. 그러나 로그를 따라가 보니 저장은 실패하지 않았습니다. 오래된 데이터를 정상적으로 저장하고 있었습니다.

문제는 저장 함수가 아니라, 어떤 데이터를 저장해야 하는지 결정하는 주체가 없었다는 점이었습니다. 각 Renderer는 같은 프로젝트 데이터의 복사본을 가지고 있었고, 어느 값이 최신인지 판단할 기준이 없었습니다.

이번 문제를 해결하며 상태 관리 도구를 선택하기 전에 먼저 결정해야 할 것이 있다는 점을 확인했습니다.

> 어떤 Store를 사용할 것인가보다, 이 데이터의 최종 결정권을 어디에 둘 것인가가 먼저입니다.

Electron 멀티 윈도우 환경에서는 각 창이 별도의 Renderer Process에서 실행됩니다. 따라서 한 Renderer의 전역 Store를 애플리케이션 전체의 전역 Store처럼 사용할 수 없습니다.

이번 프로젝트에서는 저장되는 공유 데이터의 기준을 Main Process에 두었습니다. TanStack Query Cache는 전달받은 데이터를 화면에 표시하고, Renderer의 UI 상태는 React State나 Zustand Store에 남겼습니다. 저장할 필요가 없는 일시적인 창 간 이벤트는 별도 채널로 전달했습니다.

핵심은 모든 상태를 한곳에 모으는 것이 아니었습니다. 저장되는 데이터, 화면을 위한 상태, 순간적인 UI 이벤트를 구분하고, 공유 데이터의 최신 값을 확정하는 주체를 하나로 정하는 것이었습니다.

데이터의 소유권을 먼저 정하자 TanStack Query, Zustand, IPC, MessagePort의 역할도 자연스럽게 나뉘었습니다. 새로운 상태 관리 라이브러리가 문제를 해결한 것이 아니라, 값이 서로 다를 때 무엇을 신뢰할지 명확히 정한 것이 구조를 바꿨습니다.

Electron에서 공유 데이터를 설계할 때는 “어떤 Store를 사용할까?”보다 다음 질문을 먼저 검토하는 편이 좋습니다.

> 자동 저장과 다른 Renderer는 누구의 데이터를 신뢰해야 하는가?
