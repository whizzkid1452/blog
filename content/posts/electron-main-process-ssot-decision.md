---
title: 'Electron에서는 공유 데이터를 어디에 둬야할까?'
description: '여러 Renderer가 가진 오래된 상태가 최신 SRT 자막을 덮어쓴 원인을 추적하고, Main Process의 ProjectSession을 공유 데이터의 SSOT로 재설계한 과정을 정리합니다.'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00+09:00'
tags: ['electron', 'state-management', 'zustand', 'ssot', 'autosave']
draft: false
---

## 목차

1. 자동 저장은 성공했는데 자막은 왜 사라졌을까
2. 저장 실패가 아니라 오래된 Snapshot의 저장이었다
3. Electron에서는 같은 Store를 import해도 상태가 공유되지 않는다
4. 도구를 고르기 전에 데이터의 성격부터 정리했다
5. 검토한 대안
6. Main Process를 SSOT로 선택한 이유
7. SSOT는 복사본이 하나라는 뜻이 아니다
8. ProjectSession은 왜 Class로 구현했을까
9. Renderer는 변경을 요청하고 Main이 확정한다
10. 자동 저장에는 Debounce 외에도 필요한 것이 있었다
11. Renderer Cache와 프로젝트 원본의 역할을 분리했다
12. 저장되지 않는 창 간 이벤트는 별도 채널로 분리했다
13. 변경 전후 비교
14. 트레이드오프와 남은 과제
15. 회고

---

## 1. 자동 저장은 성공했는데 자막은 왜 사라졌을까

> “SRT 자막을 수정하고 점심을 먹고 오니까 수정한 내용이 사라졌어요!”

이 제보가 문제의 시작이었습니다.

당시 Electron 기반 멀티미디어 에디터를 개발하고 있었습니다. 사용자는 Editor에서 음원과 자막을 편집할 수 있었고, Admin에서는 현재 프로젝트의 정보를 조회하거나 수정할 수 있었습니다.

SRT Script Panel은 자막 한 줄에 해당하는 SRT Row를 실시간으로 수정하는 도구였습니다. 이 패널은 별도의 `BrowserWindow`로 분리할 수 있었기 때문에 Editor와 동시에 열어 둘 수 있었습니다.

![동일 프로젝트를 편집하는 Editor와 분리된 SRT Script Panel](/images/electron-multi-window-shared-data-ssot/editor-srt-panel-browserwindows.png)

_BrowserWindow로 실행되는 Editor와 SRT Script Panel_

프로젝트에는 자동 저장도 적용되어 있었습니다. 사용자가 저장 버튼을 누르지 않아도 변경된 프로젝트 데이터를 일정 시간마다 로컬 프로젝트 파일에 기록하는 방식이었습니다.

문제가 발생했을 때도 자동 저장 자체는 정상적으로 실행되고 있었습니다.

SRT Script Panel에서 자막을 수정하면 화면에는 최신 문장이 정상적으로 표시됐습니다. 그러나 잠시 뒤 프로젝트를 다시 확인하면 자막이 수정 전 내용으로 돌아가 있었습니다.

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/self-gaslighting-hardship-meme.jpg" alt="거울을 보며 힘든 상황을 이겨내기 위해 스스로를 가스라이팅하는 모습을 표현한 밈" /></p>

_문제가 반복될 때마다 이번 디버깅이 나를 더 강하게 만들 거라고 되뇌었습니다._

저장이 누락됐다면 마지막으로 정상 저장된 값이 남아 있어야 합니다. 하지만 이번 문제에서는 이미 화면에 반영된 최신 내용이 과거 값으로 되돌아가고 있었습니다.

로그를 확인한 결과 파일 쓰기는 실패하지 않았습니다.

문제는 **다른 화면에 남아 있던 오래된 프로젝트 데이터가 정상적으로 저장되고 있었다는 것**이었습니다.

단순한 화면 갱신 오류가 아니었습니다.

사용자가 작성한 결과가 이전 데이터로 덮어써지는 실제 데이터 유실 문제였습니다.

---

## 2. 저장 실패가 아니라 오래된 Snapshot의 저장이었다

먼저 같은 SRT Row가 각 위치에서 어떤 값을 가지고 있는지 확인했습니다.

![오래된 Renderer Snapshot이 최신 SRT 자막을 덮어쓰는 순서](/images/electron-multi-window-shared-data-ssot/stale-snapshot-overwrite-sequence.png)

_오래된 Renderer Snapshot이 로컬 프로젝트 파일에 기록되는 흐름_

구조를 단순화하면 같은 프로젝트 데이터의 복사본을 네 곳에서 독립적으로 관리하고 있었습니다.

```text
SRT Script Panel Renderer ─ Project Store A ─ 최신 Snapshot
Editor Renderer           ─ Project Store B ─ 오래된 Snapshot
Admin Renderer            ─ Project Store C ─ 오래된 Snapshot
Local Project File        ─ Snapshot D       ─ 마지막 저장값
```

SRT Script Panel에서 자막을 수정하면 `Project Store A`에만 최신 값이 반영됐습니다.

이 상태에서 Editor나 Admin이 자동 저장을 요청하면 해당 Renderer가 가지고 있던 오래된 Snapshot이 로컬 프로젝트 파일에 기록됐습니다.

파일 I/O는 전달받은 값을 정확하게 저장하고 있었습니다.

잘못된 것은 저장 동작이 아니라, 저장 함수에 전달된 데이터였습니다.

그래서 디버깅의 초점도 다음 두 가지로 바뀌었습니다.

- 어느 Renderer가 저장을 요청했는가
- 요청에 포함된 Snapshot은 어느 시점의 값인가

처음에는 특정 Renderer의 동기화 코드가 누락된 문제라고 생각했습니다. 한 화면에서 변경이 발생하면 나머지 화면의 Store를 모두 갱신하면 해결할 수 있어 보였습니다.

```text
SRT Script Panel ↔ Editor
SRT Script Panel ↔ Admin
Editor           ↔ Admin
```

하지만 이 구조에는 더 근본적인 문제가 있었습니다.

Store A와 Store B의 값이 다를 때, 둘 중 무엇을 최신 값으로 판단해야 하는지 결정할 기준이 없었습니다.

창이 추가될 때마다 기존 Renderer와 새로운 Renderer 사이에 동기화 경로를 추가해야 했습니다. 이벤트가 한 번이라도 누락되면 Store들은 다시 서로 다른 Snapshot을 가지게 됩니다.

짧은 시간 안에 여러 변경이 발생하면 메시지 도착 순서와 자동 저장 실행 순서에 따라 최종 결과가 달라질 가능성도 있었습니다.

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/temporary-fix-meme.jpg" alt="코드의 오류를 손바닥으로 막고 있는 임시방편을 표현한 밈" /></p>

_동기화가 누락될 때마다 IPC를 하나씩 추가하는 방식으로는 문제에서 손을 뗄 수 없었습니다._

핵심 문제는 명확했습니다.

> 같은 데이터를 여러 Store가 독립적으로 소유하고 있었지만, 어느 값이 최신인지 결정하는 기준이 없었다.

따라서 해결해야 할 질문은 자동 저장 호출 횟수나 주기가 아니었습니다.

> 여러 창이 같은 데이터를 사용할 때, 누가 최종 상태를 확정해야 하는가?

---

## 3. Electron에서는 같은 Store를 import해도 상태가 공유되지 않는다

일반적인 React 애플리케이션에서는 Zustand나 Redux Store 하나를 만든 뒤 여러 컴포넌트가 같은 상태를 구독할 수 있습니다.

그래서 처음에는 Electron에서도 각 화면이 같은 Store 모듈을 import하면 상태가 공유될 것이라고 생각했습니다.

```ts
import { useProjectStore } from './projectStore';
```

하지만 Electron의 멀티 윈도우 환경에서는 전역의 범위가 달랐습니다.

```text
일반적인 React 애플리케이션
└─ 하나의 JavaScript 실행 환경
   └─ 하나의 Store 인스턴스


Electron 멀티 윈도우 애플리케이션
├─ BrowserWindow A
│  └─ Renderer Process A
│     └─ Store 인스턴스 A
│
└─ BrowserWindow B
   └─ Renderer Process B
      └─ Store 인스턴스 B
```

Electron 애플리케이션은 Main Process와 Renderer Process로 나뉩니다.

Main Process는 애플리케이션의 진입점과 창의 생명주기를 관리합니다. 각 `BrowserWindow`는 별도의 Renderer에서 웹 페이지를 실행하며, Renderer는 서로 독립된 JavaScript 실행 환경과 메모리를 사용합니다.

같은 Store 모듈을 import했다는 것은 각 실행 환경에서 같은 Store 생성 코드를 실행했다는 뜻입니다.

서로 다른 Renderer가 동일한 Store 인스턴스나 메모리를 공유한다는 뜻은 아닙니다.

```text
Renderer A의 projectStore
≠
Renderer B의 projectStore
```

React에서 말하는 전역 Store는 하나의 JavaScript 실행 환경 안에서만 전역입니다.

Electron에서는 창마다 Renderer와 메모리가 분리되므로 Renderer 내부 Store를 애플리케이션 전체의 전역 상태로 사용할 수 없습니다.

![여러 Renderer Store와 Electron 프로세스 경계를 보여주는 AS-IS 구조](/images/electron-multi-window-shared-data-ssot/as-is-renderer-stores.png)

_변경 전 Renderer마다 독립된 Store 인스턴스와 프로세스 경계_

이 글의 구조도에서는 데이터 흐름을 단순하게 표현하기 위해 Main과 Renderer 사이의 Preload Script를 생략했습니다.

실제 구현에서는 Renderer에 Electron API 전체를 노출하지 않고, Preload Script와 `contextBridge`를 통해 필요한 기능만 제한적으로 제공했습니다.

또한 일반적인 `ipcMain`과 `ipcRenderer`만으로 Renderer끼리 직접 메시지를 보내는 API가 제공되는 것은 아닙니다. Renderer 사이에서 데이터를 전달하려면 Main Process가 중계하거나, Main에서 MessagePort를 생성한 뒤 각 Renderer에 전달하는 구조가 필요합니다.

- [Electron Process Model](https://electronjs.org/docs/latest/tutorial/process-model)
- [Electron IPC](https://electronjs.org/docs/latest/tutorial/ipc)

---

## 4. 공유 데이터의 조건

처음에는 Zustand, TanStack Query, `useSyncExternalStore` 중 어떤 도구를 사용할지부터 고민했습니다.

하지만 어느 도구를 선택하더라도 데이터의 역할이 불분명하면 같은 문제가 반복될 수 있었습니다.

그래서 상태 관리 도구보다 먼저, 프로젝트 데이터가 어떤 조건을 충족해야 하는지 정리했습니다.

### 4.1 여러 화면이 함께 사용하는가

| 데이터                    | 사용하는 위치                   | 필요한 규칙                                  |
| ------------------------- | ------------------------------- | -------------------------------------------- |
| 프로젝트 정보와 편집 결과 | Editor, Admin, 자동 저장        | 변경이 확정되면 관련 화면과 저장 대상에 반영 |
| SRT Row와 자막 내용       | SRT Script Panel, Editor, Admin | 실시간 변경을 관련 화면과 파일에 반영        |

메인 창의 작업 페이지는 한 번에 하나만 활성화됐습니다.

반면 SRT Script Panel은 별도의 `BrowserWindow`로 분리할 수 있었기 때문에 Editor 또는 Admin과 동시에 열릴 수 있었습니다.

즉, 동일한 프로젝트 데이터를 여러 Renderer가 동시에 읽거나 변경할 수 있었습니다.

### 4.2 앱 종료 이후에도 복구해야 하는가

프로젝트 정보와 자막, 편집 결과는 애플리케이션을 종료한 뒤에도 보존돼야 했습니다.

자동 저장은 현재 확정된 프로젝트 데이터를 로컬 파일에 기록해야 했고, 애플리케이션을 다시 실행하면 이 파일을 이용해 초기 상태를 복원해야 했습니다.

다만 실행 중인 최신 상태와 영속 저장된 상태는 역할이 달랐습니다.

사용자가 자막을 입력한 직후 화면에는 파일 쓰기가 끝나기 전이라도 최신 내용이 보여야 합니다. 반면 파일은 앱이 종료된 뒤 복구하기 위한 수단입니다.

따라서 같은 프로젝트 데이터를 다음과 같이 나눠 관리할 필요가 있었습니다.

```text
실행 중인 최신 상태
└─ 메모리

앱 종료 후 복구할 상태
└─ Local Project File
```

### 4.3 특정 창의 생명주기와 독립적인가

공유 데이터는 다음 조건도 충족해야 했습니다.

- 특정 창을 닫아도 현재 프로젝트 데이터가 유지돼야 한다.
- 새로 열린 창도 가장 최근의 프로젝트 데이터를 조회할 수 있어야 한다.
- 열려 있는 관련 화면은 확정된 변경 결과를 전달받아야 한다.
- 모든 저장 경로는 동일한 최신 Snapshot을 사용해야 한다.

정리하면 실행 중인 프로젝트 데이터는 다음과 같은 성격을 가지고 있었습니다.

```text
여러 창이 함께 사용한다.
        +
실시간으로 변경된다.
        +
관련 화면에 반영돼야 한다.
        +
로컬 프로젝트 파일에 저장돼야 한다.
        +
특정 창을 닫아도 유지돼야 한다.
```

이 조건을 정리하고 나니 문제는 Store 간 복사 경로보다 **데이터 소유권**에 가까웠습니다.

먼저 최신 값을 확정할 주체를 정한 뒤, Renderer와 파일이 그 값을 어떻게 전달받을지 설계해야 했습니다.

---

## 5. 검토한 대안

### 5.1 Renderer Store를 서로 동기화한다

가장 먼저 생각한 방법은 한 Renderer의 Store가 변경될 때 다른 Renderer의 Store에도 같은 내용을 전달하는 방식이었습니다.

```text
Renderer A 변경
    ↓
Renderer B Store 갱신
    ↓
Renderer C Store 갱신
```

기존 구조를 크게 바꾸지 않아도 된다는 장점이 있습니다. 창이 적고 변경 빈도가 낮다면 비교적 빠르게 구현할 수도 있습니다.

하지만 프로젝트 데이터의 소유권은 여전히 여러 Renderer에 분산됩니다.

- 창이 추가될 때마다 동기화 대상이 늘어난다.
- 메시지가 누락되면 다시 서로 다른 Snapshot을 갖게 된다.
- 양쪽에서 동시에 변경하면 무엇을 최신으로 볼지 결정하기 어렵다.
- 새로 열린 Renderer는 이전에 발생한 이벤트를 받을 수 없다.
- 자동 저장 시 어느 Store를 사용해야 하는지 다시 결정해야 한다.

동기화 코드를 추가하는 것만으로는 “누가 최종 상태를 결정하는가”라는 질문에 답할 수 없었습니다.

따라서 Renderer 간 동기화는 최종 구조에서 제외했습니다.

---

### 5.2 Local Project File을 SSOT로 사용한다

다음으로 검토한 방법은 모든 Renderer가 로컬 프로젝트 파일을 기준으로 동작하는 구조였습니다.

```text
Renderer에서 변경
       ↓
로컬 파일에 저장
       ↓
다른 Renderer가 파일을 다시 읽음
       ↓
화면 갱신
```

파일 하나를 기준으로 여러 화면의 값을 맞출 수 있다는 장점이 있습니다.

하지만 로컬 파일은 영속 저장에는 적합해도 실행 중인 최신 상태를 조정하는 주체로 사용하기에는 한계가 있었습니다.

- 연속된 입력마다 파일 읽기와 쓰기를 수행해야 한다.
- 화면 반영 시점이 파일 I/O 완료 시점에 종속된다.
- 여러 쓰기의 시작 순서와 완료 순서를 따로 제어해야 한다.
- 쓰기가 끝나기 전에 파일을 다시 읽으면 이전 값이 반환될 수 있다.
- Renderer마다 파일을 읽은 시점이 다르면 서로 다른 내용을 볼 수 있다.
- 파일 시스템이 영속 저장과 실행 상태 조정이라는 두 책임을 모두 갖게 된다.

무엇보다 이번 문제는 오래된 Snapshot이 파일에 저장되면서 발생했습니다.

파일을 기준으로 사용하더라도 어떤 Snapshot을 기록할지는 다른 주체가 결정해야 합니다.

따라서 로컬 프로젝트 파일은 다음 책임에만 사용하기로 했습니다.

```text
실행 중인 최신 데이터
└─ 메모리의 ProjectSession

앱 종료 후에도 보존할 데이터
└─ Local Project File
```

---

### 5.3 Main Process가 원본을 소유한다

마지막으로 검토한 구조는 Main Process에서 실행 중인 프로젝트 데이터를 관리하는 방식이었습니다.

질문을 다음과 같이 바꿨습니다.

> 변경 내용을 어느 화면에 더 전달할 것인가가 아니라, 어느 프로세스가 원본을 소유해야 하는가?

우리 애플리케이션에서는 프로젝트 파일 저장을 이미 Main Process가 담당하고 있었습니다.

```text
Renderer에서 변경
       ↓
Main Process
       ↓
Local Project File
```

Main Process는 각 Renderer에 메시지를 전달할 수 있으며, 특정 화면의 생명주기에도 종속되지 않습니다.

```text
Editor 창 종료
    ↓
Editor Renderer 종료

Main Process
    ↓
ProjectSession 유지
```

Editor가 닫혀도 Main의 프로젝트 상태는 유지할 수 있습니다.

나중에 Admin이나 SRT Script Panel이 열리면 Main이 가진 현재 Snapshot을 다시 전달할 수도 있습니다.

이 조건들이 앞에서 정리한 요구사항과 가장 잘 맞았기 때문에 Main Process에 실행 중인 공유 데이터의 SSOT를 두기로 했습니다.

![Main Process의 ProjectSession을 SSOT로 둔 TO-BE 구조](/images/electron-multi-window-shared-data-ssot/to-be-project-document-service.png)

_Main Process의 ProjectSession을 SSOT로 둔 구조_

다만 모든 상태를 Main Process로 옮긴 것은 아닙니다.

다음 조건을 만족하는 데이터만 Main의 공유 상태로 관리했습니다.

- 여러 Renderer가 함께 사용한다.
- 로컬 프로젝트 파일에 저장돼야 한다.
- 특정 창이 닫혀도 유지돼야 한다.
- 화면에서 보는 최신 값과 저장되는 값이 일치해야 한다.

Modal, Hover, Filter, 검색어처럼 특정 화면에서만 사용하는 상태는 기존처럼 각 Renderer에서 관리했습니다.

---

## 6. Main Process를 SSOT로 선택한 이유

Main Process를 선택한 이유를 정리하면 다음과 같습니다.

### 6.1 특정 Renderer의 생명주기에 종속되지 않는다

Renderer가 공유 데이터의 원본을 소유하면 해당 창이 닫힐 때 상태도 함께 사라질 수 있습니다.

Main Process는 애플리케이션이 실행되는 동안 유지되므로 현재 프로젝트를 특정 화면과 분리해 관리할 수 있습니다.

### 6.2 파일 저장 경로를 일관되게 만들 수 있다

기존에는 저장을 요청한 Renderer의 Store가 파일에 기록될 수 있었습니다.

Main이 원본을 관리하면 자동 저장은 항상 Main의 현재 Snapshot을 기준으로 실행할 수 있습니다.

```text
기존

Renderer Store
    ↓
자동 저장


변경 후

Renderer
    ↓ 변경 요청
Main ProjectSession
    ↓ 최신 Snapshot 확정
자동 저장
```

### 6.3 새로 열린 창도 현재 상태를 조회할 수 있다

이벤트 기반 동기화만 사용하면 나중에 열린 창은 과거 이벤트를 받을 수 없습니다.

Main이 현재 Snapshot을 보관하면 새로 열린 Renderer가 초기화 시점에 현재 값을 다시 요청할 수 있습니다.

### 6.4 모든 변경 경로를 한곳으로 모을 수 있다

각 Renderer가 프로젝트 데이터를 직접 수정하지 않고 Main에 변경 요청을 전달하도록 하면 검증, version 증가, 자동 저장, Broadcast를 같은 흐름에서 처리할 수 있습니다.

---

## 7. SSOT는 복사본이 하나라는 뜻이 아니다

Main Process를 SSOT로 정했다고 해서 Renderer에 프로젝트 데이터가 없어야 하는 것은 아닙니다.

Renderer가 화면을 렌더링하려면 로컬 상태가 필요합니다. 로컬 프로젝트 파일도 앱 재실행 후 복구를 위해 데이터를 보관해야 합니다.

따라서 실제로는 여러 위치에 프로젝트 데이터의 복사본이 존재합니다.

```text
Main ProjectSession
└─ 실행 중인 최신 Snapshot

Renderer Cache
└─ 화면 렌더링을 위한 복사본

Local Project File
└─ 앱 종료 이후 복구를 위한 복사본
```

이번 구조에서 SSOT는 다음과 같이 정의했습니다.

> 데이터의 복사본이 물리적으로 하나뿐이라는 뜻이 아니라, 값이 서로 다를 때 무엇을 기준으로 맞출지 결정하는 주체가 하나라는 뜻이다.

예를 들어 SRT Script Panel에서 자막을 수정한 직후에는 세 위치의 값이 일시적으로 다를 수 있습니다.

```text
Main ProjectSession
└─ “안녕하세요. 수정된 자막입니다.”

Editor Renderer Cache
└─ “안녕하세요.”

Local Project File
└─ “안녕하세요.”
```

이때 Renderer Cache와 로컬 파일에 남아 있는 값은 원본 후보가 아닙니다.

Main이 확정한 Snapshot을 관련 Renderer에 전달하고, 로컬 파일에도 같은 Snapshot을 기록합니다.

즉, **값이 다르면 Main의 ProjectSession을 기준으로 수렴시킨다**는 규칙이 이번 구조에서의 SSOT입니다.

| 위치                  | 역할                                             |
| --------------------- | ------------------------------------------------ |
| Main `ProjectSession` | 최신 Snapshot 결정과 프로젝트 변경 규칙 적용     |
| Renderer Cache        | 화면 렌더링을 위한 로컬 복사본                   |
| Local Project File    | 앱 종료 이후에도 데이터를 유지하고 복구하는 파일 |

---

## 8. ProjectSession은 왜 Class로 구현했을까

SSOT의 위치를 정한 뒤에는 Main Process에서 프로젝트 데이터를 어떤 형태로 관리할지 결정해야 했습니다.

Main Process에는 React 컴포넌트 트리가 없기 때문에 `useState`나 React Context처럼 렌더링을 전제로 하는 도구를 사용할 수 없습니다.

다음 세 가지 방법을 검토했습니다.

- Plain Object
- Class private field
- Vanilla Zustand

### 8.1 Plain Object

현재 프로젝트 데이터를 보관하는 것만 필요하다면 일반 객체로도 충분합니다.

```ts
let currentProject: ProjectSnapshot = initialProjectSnapshot;
```

하지만 이번 구조에서는 값 보관 외에도 다음 규칙이 필요했습니다.

- 현재 프로젝트 데이터 조회
- 변경 요청 검증
- 프로젝트 변경 적용
- 확정된 결과 반환
- 외부 코드의 직접 변경 방지

Plain Object로도 구현은 가능하지만, 외부 코드가 값을 직접 바꾸지 못하게 막고 모든 변경을 한 경로로 통합하려면 별도의 API 경계가 필요했습니다.

결국 중요한 것은 데이터를 어떤 객체에 넣는지가 아니라, **누가 어떤 메서드를 통해 변경할 수 있는가**였습니다.

### 8.2 Class private field

Class를 사용하면 프로젝트 데이터를 private field로 감추고 외부에는 허용된 메서드만 공개할 수 있습니다.

```ts
projectSession.getSnapshot();
projectSession.dispatch(action);
```

IPC Handler, 자동 저장, Renderer 갱신 코드가 내부 데이터를 직접 수정하지 않고 모두 같은 변경 경로를 사용하도록 만들 수 있었습니다.

### 8.3 Vanilla Zustand

Zustand의 `createStore`를 사용하면 React 없이도 Vanilla Store를 만들 수 있습니다.

생성된 Store는 `getState`, `setState`, `subscribe` 등을 제공하므로 Main 내부에서 Selector 기반 구독이나 Middleware가 필요하다면 유용할 수 있습니다.

- [Zustand createStore](https://zustand.docs.pmnd.rs/reference/apis/create-store)

다만 당시 Main Process에서는 여러 소비자가 프로젝트 상태 일부를 각각 구독할 필요가 없었습니다.

변경 결과는 `dispatch`의 반환값으로 Event Publisher와 Autosave Coordinator에 전달할 수 있었고, 무엇보다 모든 변경을 `ProjectSession`의 공개 메서드로 제한할 필요가 있었습니다.

| 기준          | Class private field  | Vanilla Zustand                       |
| ------------- | -------------------- | ------------------------------------- |
| 변경 API 제한 | public method로 제한 | `setState` 노출 범위를 별도로 제한    |
| Selector 구독 | 필요하면 직접 구현   | Store API로 제공                      |
| Middleware    | 필요하면 직접 구현   | 생태계 활용 가능                      |
| 당시 요구사항 | 필요한 경계만 제공   | `ProjectSession` API와 일부 역할 중복 |

따라서 초기 구현에서는 Vanilla Zustand를 Main의 저장소로 추가하지 않고 `ProjectSession`의 private field에 프로젝트 데이터를 보관했습니다.

별도의 Store API를 다시 감싸기보다 필요한 조회와 변경 메서드만 공개하는 Class가 당시 요구사항에 더 작게 맞았습니다.

향후 Main 내부의 여러 모듈이 독립적인 Selector 구독이나 Middleware를 필요로 한다면 Vanilla Zustand를 다시 검토할 수 있습니다.

다만 그것은 미래의 확장 가능성이고, 현재 선택의 근거는 아니었습니다.

---

## 9. Renderer는 변경을 요청하고 Main이 확정한다

Main Process에서 관리할 데이터를 하나의 `ProjectSnapshot`으로 묶었습니다.

아래 타입은 설명에 필요한 필드만 남긴 예시입니다.

```ts
type ProjectSnapshot = {
  version: number;
  projectInfo: ProjectInfo;
  scriptRows: SrtRow[];
};
```

`version`은 Main에서 프로젝트 변경을 확정한 순서를 나타냅니다.

`ProjectSession`은 현재 Snapshot을 private field로 관리하고 외부에는 조회와 변경 요청 API만 제공합니다.

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

`applyProjectAction`은 요청을 검증한 뒤 새로운 프로젝트 문서를 생성하는 순수 함수입니다.

`structuredClone`을 사용한 이유는 외부에 전달한 객체가 다시 변경되면서 `ProjectSession` 내부 데이터까지 영향을 받는 것을 막기 위해서입니다.

기존에는 각 Renderer가 자신의 Store를 먼저 변경했고, 그 Store가 자동 저장에 사용될 수 있었습니다.

변경 후에는 Renderer가 프로젝트 상태를 직접 확정하지 않습니다.

Renderer는 사용자의 변경 의도를 `ProjectAction`으로 Main에 전달합니다.

```ts
const updateResult = await window.project.dispatch({
  actionId: crypto.randomUUID(),
  baseVersion: projectSnapshot.version,
  type: 'srt-row-text-updated',
  payload: {
    rowId,
    text: nextText,
  },
});
```

Main Process는 요청을 받은 뒤 `ProjectSession`을 변경합니다.

```ts
ipcMain.handle('project:dispatch', (_event, action: ProjectAction) => {
  const updateResult = projectSession.dispatch(action);
  const snapshot = projectSession.getSnapshot();

  projectEventPublisher.publish(updateResult);
  autosaveCoordinator.schedule(snapshot);

  return updateResult;
});
```

전체 흐름은 다음과 같습니다.

```text
SRT Script Panel Renderer
    ↓ ProjectAction
Main IPC Handler
    ↓ dispatch
ProjectSession
    ├─ Snapshot과 version 확정
    ├─ Autosave Coordinator에 전달
    └─ 관련 Renderer에 확정 결과 발행
```

![Main Process에서 확정한 Snapshot을 파일 저장과 Renderer 화면 갱신에 사용하는 흐름](/images/electron-multi-window-shared-data-ssot/project-document-update-save-broadcast.png)

_Main Process에서 확정한 Snapshot을 파일 저장과 Renderer 화면 갱신에 사용하는 흐름_

### 9.1 Version으로 변경 순서를 구분한다

IPC 응답과 Broadcast는 전송을 시작한 순서와 다르게 도착할 수 있습니다.

단순히 데이터의 내용만 비교하면 어느 결과가 Main에서 나중에 확정됐는지 판단하기 어렵습니다.

그래서 `ProjectSession`에서 변경을 확정할 때마다 단조 증가하는 `version`을 함께 기록했습니다.

```text
version 10
    ↓ 변경 확정
version 11
    ↓ 변경 확정
version 12
```

Renderer는 전달받은 Snapshot의 `version`을 기준으로 현재 Cache보다 오래된 결과를 무시할 수 있습니다.

### 9.2 baseVersion은 충돌을 감지하기 위한 정보다

Renderer가 보내는 `baseVersion`은 해당 변경 요청이 어느 Snapshot을 기준으로 생성됐는지를 나타냅니다.

```ts
{
  baseVersion: 12,
  type: 'srt-row-text-updated',
}
```

Main의 현재 version이 14라면 해당 요청은 최신 Snapshot보다 오래된 상태를 기준으로 만들어졌다는 사실을 알 수 있습니다.

다만 `baseVersion`이 다르다는 이유만으로 모든 요청을 무조건 거절해야 하는 것은 아닙니다.

예를 들어 서로 다른 SRT Row를 수정한 요청이라면 두 변경을 모두 적용할 수 있을 수도 있습니다.

반대로 같은 Row를 동시에 수정했다면 충돌 정책이 필요합니다.

- 오래된 요청 거절
- 마지막 요청 우선
- 항목 단위 충돌 비교
- 사용자에게 충돌 해결 요청

어떤 방식을 사용할지는 프로젝트 데이터의 특성과 제품 정책에 따라 결정해야 합니다.

`version`은 충돌을 자동으로 해결하는 기능이 아니라, **변경 순서와 충돌 가능성을 판단할 수 있게 해주는 정보**로 사용했습니다.

---

## 10. 자동 저장에는 Debounce 외에도 필요한 것이 있었다

자동 저장에서 가장 중요한 규칙은 다음과 같습니다.

> Renderer가 가진 프로젝트 데이터로 파일을 직접 저장하지 않는다.

사용자의 변경은 Main Process의 메모리 Snapshot에서 먼저 확정합니다.

파일 쓰기는 비동기로 처리하되, 이전 Snapshot의 저장이 나중에 완료되면서 최신 파일을 다시 덮어쓰지 않도록 해야 했습니다.

```text
사용자 입력
    ↓
Main Snapshot 즉시 변경
    ↓
Debounce 동안 pending Snapshot 교체
    ↓
같은 프로젝트의 파일 쓰기를 하나씩 실행
```

이 과정에는 서로 다른 세 가지 제어가 필요했습니다.

### 10.1 Debouncing

사용자가 연속으로 입력하는 동안 저장 시작 시점을 뒤로 미뤄 불필요한 파일 쓰기를 줄입니다.

예를 들어 사용자가 한 문장을 입력할 때 글자마다 파일을 저장하지 않고, 입력이 잠시 멈춘 뒤 최신 Snapshot을 저장합니다.

하지만 Debounce만으로는 진행 중인 비동기 파일 쓰기의 완료 순서를 제어할 수 없습니다.

### 10.2 Coalescing

저장을 기다리는 Snapshot이 여러 개라면 각각 파일로 기록하지 않고, 다음에 저장할 pending Snapshot을 가장 최신 값으로 교체합니다.

예를 들어 version 10을 저장하는 동안 version 11, 12, 13이 확정됐다고 가정하겠습니다.

```text
현재 저장 중
└─ version 10

저장 대기
├─ version 11
├─ version 12
└─ version 13
```

version 11과 12를 모두 디스크에 기록할 필요는 없습니다.

version 10의 쓰기가 끝난 뒤 아직 저장되지 않은 가장 최신 Snapshot인 version 13을 기록하면 됩니다.

```text
version 10 저장
    ↓
version 13 저장
```

여기서 Coalescing은 Snapshot의 내용을 서로 병합하는 merge가 아닙니다.

**다음에 저장할 Snapshot 참조를 가장 최신 값으로 교체하는 동작**입니다.

### 10.3 Queued sequential execution

같은 프로젝트 파일에 대한 비동기 쓰기는 한 번에 하나만 실행합니다.

앞선 쓰기가 끝난 뒤 다음 쓰기를 시작하도록 대기열을 구성해야 저장 완료 순서가 뒤집히는 것을 막을 수 있습니다.

```text
write(version 10)
    ↓ 완료
write(version 13)
    ↓ 완료
```

이것은 프로젝트의 모든 변경을 비동기로 직렬화한다는 뜻은 아닙니다.

메모리의 Snapshot과 version은 각 변경 요청을 처리할 때 즉시 확정합니다.

대기열에서 하나씩 실행하는 대상은 **동일한 프로젝트 파일에 대한 비동기 파일 쓰기**입니다.

### 10.4 Flush

앱 종료나 프로젝트 전환 시 Debounce를 기다리고 있는 pending Snapshot이 있다면 저장이 누락될 수 있습니다.

따라서 다음 시점에는 pending 저장을 즉시 실행하고 완료를 기다리는 `flush`가 필요합니다.

- 앱 종료 전
- 현재 프로젝트를 닫기 전
- 다른 프로젝트로 전환하기 전
- 저장 위치를 변경하기 전

자동 저장은 단순히 일정 시간 뒤 `writeFile`을 호출하는 기능이 아니었습니다.

메모리 상태와 영속 상태의 책임을 분리하고, 파일 쓰기 횟수와 완료 순서, 종료 시점을 함께 제어해야 했습니다.

---

## 11. Renderer Cache와 프로젝트 원본의 역할을 분리했다

Main의 Snapshot이 변경되면 Renderer 화면도 갱신돼야 합니다.

이 애플리케이션은 이미 프로젝트 조회 결과를 TanStack Query로 관리하고 있었습니다.

따라서 Renderer용 프로젝트 Store를 별도로 추가하지 않고 기존 Query Cache를 화면 렌더링용 복사본으로 사용했습니다.

Main에서 확정 결과를 전달받으면 Query Cache에 반영합니다.

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

현재 Cache보다 낮거나 같은 version이 도착하면 무시하고, 더 높은 version만 적용합니다.

`setQueryData`는 이미 전달받은 데이터를 Cache에 동기적으로 반영할 때 사용했습니다. 기존 Cache 객체를 직접 수정하지 않고 새로운 Snapshot을 반환하도록 구성했습니다.

- [TanStack Query setQueryData](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata)

Main의 `ProjectSession`과 Renderer의 Query Cache는 서로 다른 역할을 가집니다.

```text
Main ProjectSession
└─ 무엇이 최신인지 결정하는 SSOT

Renderer TanStack Query Cache
└─ 확정된 데이터를 화면에 표시하기 위한 복사본
```

여기서 읽기 전용 복사본이라는 표현은 JavaScript 객체를 기술적으로 변경할 수 없다는 뜻이 아닙니다.

UI가 Cache의 값을 프로젝트 최종 상태로 확정하지 않고, 사용자의 변경을 다시 Main에 요청한다는 API 규칙을 의미합니다.

### 11.1 useSyncExternalStore를 사용하지 않은 이유

`useSyncExternalStore`도 검토했습니다.

이 Hook은 React 외부 Store의 값을 React 컴포넌트에서 읽고, 변경을 구독할 수 있도록 연결합니다.

하지만 `useSyncExternalStore`가 Main Process에 공유 Store를 만들어 주거나 서로 다른 Renderer의 메모리를 연결해 주는 것은 아닙니다.

- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)

이번 구조에서는 TanStack Query가 Renderer 내부 Cache 구독과 React 렌더링 갱신을 이미 담당하고 있었습니다.

따라서 별도의 Renderer Store와 `useSyncExternalStore`를 추가하지 않았습니다.

도구를 추가하는 대신 기존 Query Cache의 역할을 명확하게 제한했습니다.

- 프로젝트의 최종 상태는 Main에서 확정한다.
- Query Cache는 확정된 결과를 표시한다.
- 사용자 변경은 Main에 Action으로 요청한다.
- 낮은 version의 결과는 Cache에 적용하지 않는다.

향후 프로젝트 규모가 커져 전체 Snapshot을 매번 전달하는 비용이 커진다면 변경된 영역만 Patch로 전달하는 방식을 검토할 수 있습니다.

---

## 12. 저장되지 않는 창 간 이벤트는 별도 채널로 분리했다

프로젝트 데이터와 비슷해 보이지만 파일에 저장할 필요가 없는 이벤트도 있었습니다.

Editor에서 특정 Region을 클릭하면 SRT Script Panel에서 연결된 Row를 Highlight하고 해당 위치로 스크롤해야 했습니다.

```text
Editor에서 Region 클릭
        ↓
SRT Script Panel의 Row Highlight
        ↓
해당 Row 위치로 Scroll
```

이 이벤트는 여러 창 사이에 전달돼야 하지만 프로젝트 데이터는 아닙니다.

Region 선택과 Scroll 위치는 앱을 다시 실행했을 때 복구할 필요가 없는 일시적인 UI 상태입니다.

이 값을 `ProjectSession`에 포함하면 단순한 Row 클릭에도 프로젝트 Snapshot 변경과 자동 저장이 발생할 수 있습니다.

```text
Region 클릭
    ↓
Project Snapshot 변경
    ↓
프로젝트 파일 저장
    ↓
모든 Renderer에 Snapshot Broadcast
```

그래서 데이터를 성격에 따라 세 종류로 분리했습니다.

| 데이터 종류           | 예시                              | 관리 위치                | 파일 저장 |
| --------------------- | --------------------------------- | ------------------------ | --------- |
| 저장되는 공유 데이터  | SRT Row, 프로젝트 정보, 편집 결과 | Main `ProjectSession`    | 필요      |
| Renderer 내부 상태    | Modal, Filter, Hover              | React State 또는 Zustand | 불필요    |
| 일시적인 창 간 이벤트 | Highlight, Scroll, Selection      | IPC 또는 MessagePort     | 불필요    |

단발성 이벤트는 일반 IPC를 통해 전달할 수 있습니다.

지속적이거나 빈도가 높은 이벤트를 별도 채널로 분리할 필요가 있다면 `MessageChannelMain`과 `MessagePortMain`을 사용할 수 있습니다.

Main에서 연결된 Port 쌍을 생성해 각 Renderer에 전달하면 초기 연결 이후 지속적인 메시지 채널을 구성할 수 있습니다.

- [Electron MessagePorts](https://electronjs.org/docs/latest/tutorial/message-ports)

```text
Editor Renderer
      │
      │ Region Selected
      ▼
MessagePort Channel
      │
      ▼
SRT Script Panel Renderer
      │
      ├─ Row Highlight
      └─ Scroll
```

Main Process는 채널 연결만 담당하고 해당 이벤트를 프로젝트 Snapshot에는 저장하지 않습니다.

이 구분을 통해 `ProjectSession`이 모든 화면 상호작용을 처리하는 거대한 Event Bus로 확장되는 것을 방지했습니다.

---

## 13. 변경 전후 비교

### AS IS

```text
각 Renderer
└─ 프로젝트 데이터의 복사본을 독립적으로 관리

자동 저장
└─ 호출된 Renderer의 Store를 기준으로 실행
```

기존 구조에는 다음 문제가 있었습니다.

- 창마다 Store 인스턴스가 달랐다.
- 동일한 프로젝트 데이터에 여러 기준점이 존재했다.
- 사용자가 편집한 값과 자동 저장되는 값이 달라질 수 있었다.
- 오래된 Snapshot이 최신 SRT 자막을 덮어쓸 수 있었다.
- 새로 열린 화면은 이전 변경 이벤트를 받을 수 없었다.
- 저장 데이터와 일시적인 UI 이벤트가 같은 흐름에 섞여 있었다.

### TO BE

```text
Renderer
   ↓ ProjectAction
Main Process의 ProjectSession
   ├─ Snapshot과 version 확정
   ├─ Project Event Publisher → 관련 Renderer
   └─ Autosave Coordinator → Local Project File
```

변경 후에는 각 역할이 다음과 같이 정리됐습니다.

- Main의 `ProjectSession`이 공유 데이터의 최신 값을 결정한다.
- Renderer는 프로젝트 데이터를 직접 확정하지 않고 Main에 변경을 요청한다.
- 자동 저장은 항상 `ProjectSession`의 Snapshot을 사용한다.
- Main이 확정한 결과를 관련 Renderer에 전달한다.
- TanStack Query Cache는 화면 렌더링을 위한 복사본으로 사용한다.
- 새로 열린 창은 Main의 현재 Snapshot을 다시 요청한다.
- 로컬 프로젝트 파일은 영속 저장과 앱 재실행 시 복구에 사용한다.
- Highlight와 Scroll 같은 임시 이벤트는 별도 채널로 전달한다.

최종적으로 상태와 이벤트의 흐름은 다음과 같이 나뉘었습니다.

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

---

## 14. 트레이드오프와 남은 과제

Main Process를 SSOT로 둔다고 해서 모든 문제가 자동으로 해결되는 것은 아닙니다.

명확한 장점이 있는 만큼 새로운 비용도 생겼습니다.

### 14.1 장점

- 공유 데이터의 소유권이 명확해졌다.
- 화면에 표시되는 값과 저장되는 값이 같은 기준을 사용한다.
- Renderer 생명주기와 프로젝트 데이터가 분리됐다.
- 새로 열린 창이 현재 Snapshot을 다시 조회할 수 있다.
- 변경 검증과 version 증가 경로를 통합할 수 있다.
- 자동 저장이 특정 Renderer Store에 의존하지 않는다.
- 프로젝트 데이터와 UI 이벤트의 책임을 분리할 수 있다.

### 14.2 비용

#### 모든 프로젝트 변경이 IPC 경계를 통과한다

Renderer에서 발생한 변경은 Main에 요청한 뒤 다시 확정 결과를 전달받아야 합니다.

따라서 Action 타입, IPC 계약, 에러 처리 구조를 일관되게 관리해야 합니다.

#### Main Process가 비대해질 수 있다

공유 상태를 Main에서 관리한다고 해서 모든 로직을 하나의 Class에 넣으면 안 됩니다.

이번 구조에서는 책임을 다음처럼 나눴습니다.

```text
ProjectSession
└─ 변경 검증과 ProjectSnapshot 갱신

Project Event Publisher
└─ 열린 Renderer에 확정 결과 발행

Autosave Coordinator
└─ Debounce, Coalescing, Queue, Flush

Project Repository
└─ JSON 변환과 로컬 프로젝트 파일 교체

IPC Handler
└─ Preload에 노출할 API와 입력 검증 경계
```

`ProjectSession`은 파일 형식이나 Renderer Cache를 알지 않습니다.

Repository는 무엇을 언제 저장할지 결정하지 않습니다.

각 모듈의 책임을 분리하지 않으면 Main Process가 새로운 거대한 Store 또는 Service가 될 수 있습니다.

#### Snapshot 전달 비용이 증가할 수 있다

현재는 구현 복잡도를 낮추기 위해 확정된 Snapshot을 전달했습니다.

하지만 프로젝트 데이터가 커지면 변경할 때마다 전체 Snapshot을 복사하고 IPC로 전달하는 비용이 커질 수 있습니다.

그 경우 다음 방식을 검토할 수 있습니다.

- 변경된 영역만 Patch로 전달
- Snapshot 조회와 Event Patch를 분리
- SRT Row 단위 정규화
- 필요한 Renderer에만 선택적으로 Broadcast
- 큰 바이너리 데이터와 프로젝트 메타데이터 분리

#### 충돌 정책이 필요하다

`version`과 `baseVersion`은 충돌 가능성을 감지할 수 있게 해주지만 충돌을 해결해 주지는 않습니다.

여러 Renderer가 같은 데이터를 동시에 수정할 수 있다면 도메인에 맞는 충돌 정책이 필요합니다.

#### 저장 실패에 대한 복구 정책이 필요하다

Main의 메모리 상태는 최신이지만 파일 저장이 실패할 수 있습니다.

따라서 다음 항목도 별도로 다뤄야 합니다.

- 저장 실패 상태 표시
- 재시도 정책
- 임시 파일 작성 후 원본 교체
- 마지막 성공 version 기록
- 앱 종료 시 저장 실패 처리
- 손상된 파일 복구

이번 구조는 “무엇이 최신 상태인가”를 결정하는 문제를 해결한 것입니다.

충돌 해결, 파일 손상 복구, 대규모 Snapshot 성능 문제는 그 위에서 별도로 설계해야 합니다.

---

## 15. 회고

처음에는 자동 저장 코드나 Renderer 간 동기화 이벤트가 일부 누락된 문제라고 생각했습니다.

하지만 로그를 따라가며 확인한 실제 원인은 저장 실패가 아니라 **오래된 상태의 정상 저장**이었습니다.

이 문제를 해결하면서 상태 관리에서 가장 먼저 정해야 할 것은 Zustand, Redux, TanStack Query 같은 도구가 아니라 데이터의 역할과 소유권이라는 점을 다시 확인했습니다.

같은 데이터를 여러 위치에 둘 수는 있습니다.

다만 값이 서로 달라졌을 때 무엇을 기준으로 맞출지 결정할 수 있어야 합니다.

이번 구조에서는 Main Process의 `ProjectSession`이 그 기준이 됐습니다. Renderer Cache는 화면 표시를 담당하고, 로컬 파일은 앱 종료 이후의 복구를 담당하도록 역할을 분리했습니다.

또한 “여러 창에서 사용한다”는 이유만으로 모든 상태를 Main에 넣어서는 안 된다는 점도 배웠습니다.

프로젝트 데이터, Renderer 로컬 상태, 일시적인 창 간 이벤트를 구분하지 않으면 SSOT가 모든 것을 처리하는 거대한 Event Bus로 변할 수 있습니다.

실무에서는 항상 충분한 시간을 가지고 이상적인 구조를 설계할 수 있는 것은 아닙니다. 빠르게 문제를 막아야 하는 순간도 분명히 있습니다.

다만 임시 동기화 코드를 계속 추가하는 방식은 언젠가 기술 부채뿐 아니라, 시스템을 이해하기 어렵게 만드는 인지적 부채로 돌아옵니다.

특히 여러 화면과 자동 저장이 같은 데이터를 다루는 구조에서는 데이터 소유권이 불분명할수록 작은 변경의 영향 범위를 예측하기 어려워집니다.

이번 경험 이후 상태 관리 구조를 설계할 때 다음 질문을 먼저 확인하게 됐습니다.

- 이 데이터는 누가 소유하는가?
- 누가 변경을 최종 확정하는가?
- 값이 다르면 무엇을 기준으로 맞추는가?
- 화면이 닫혀도 유지돼야 하는가?
- 앱을 종료한 뒤에도 복구해야 하는가?
- 저장 데이터인가, 화면 상태인가, 일시적인 이벤트인가?

모든 선택에 “왜?”라고 물었을 때 답할 수 있는 구조를 만드는 것이 목표입니다.

처음부터 모든 미래를 예측할 수는 없지만, 적어도 현재 요구사항과 선택의 근거를 명확하게 남겨 두면 다음 변경이 필요한 순간에도 더 나은 판단을 할 수 있다고 생각합니다.
