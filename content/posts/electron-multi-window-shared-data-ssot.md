---
title: 'Electron에서는 공유 데이터를 어디에 둬야 할까?'
description: '멀티 윈도우 환경에서 오래된 Renderer 상태가 최신 SRT 자막을 덮어쓴 원인을 분석하고, Main Process의 ProjectSession을 공유 데이터의 SSOT로 재설계한 과정을 정리합니다.'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00+09:00'
tags: ['electron', 'state-management', 'zustand', 'ssot', 'autosave']
draft: false
---

## 목차

## 1. 문제 상황: 자동 저장 이후 최신 SRT 자막이 사라졌다

> “SRT 자막을 수정하고 점심을 먹고 오니까 수정한 내용이 사라졌어요!”

이 제보가 문제의 시작이었습니다.

당시 Electron으로 SubRip Subtitle(SRT) 형식의 자막과 음성을 함께 편집하는 멀티미디어 에디터를 개발하고 있었습니다. Editor는 SRT 자막과 연결된 편집 정보를 다루는 메인 화면이었고, Admin은 현재 프로젝트와 SRT 데이터를 조회하거나 수정하는 화면이었습니다. SRT Script Panel은 자막 한 줄에 해당하는 SRT Row를 실시간으로 수정하는 도구로, 별도의 `BrowserWindow`로 분리할 수 있었습니다.

사용자는 Editor와 SRT Script Panel을 동시에 열어 둔 채 같은 프로젝트의 SRT 자막을 수정할 수 있었습니다.

![동일 프로젝트를 편집하는 Editor와 분리된 SRT Script Panel](/images/electron-multi-window-shared-data-ssot/editor-srt-panel-browserwindows.png)

_BrowserWindow로 실행되는 Editor와 SRT Script Panel_

프로젝트에는 자동 저장 기능도 적용되어 있었습니다. 사용자가 저장 버튼을 누르지 않아도 변경된 프로젝트 데이터를 로컬 프로젝트 파일에 계속 기록하는 방식이었습니다.

수정 직후에는 SRT Script Panel에 최신 문장이 정상적으로 표시됐습니다. 그러나 프로젝트를 다시 확인하면 SRT 자막이 수정 전 내용으로 돌아가 있었습니다.

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/self-gaslighting-hardship-meme.jpg" alt="거울을 보며 힘든 상황을 이겨내기 위해 스스로를 가스라이팅하는 모습을 표현한 밈" /></p>

_문제가 반복될 때마다 이번 디버깅이 나를 더 강하게 만들 거라고 되뇌었습니다._

저장 요청 자체가 누락됐다면 마지막으로 저장된 값이 남아 있어야 합니다. 하지만 이번 문제에서는 이미 반영된 최신 내용이 과거 데이터로 되돌아가고 있었습니다.

로그를 확인한 결과 자동 저장은 중단되거나 실패하지 않았습니다. 문제는 다른 화면에 남아 있던 수정 전 데이터가 자동 저장되면서, **사용자가 방금 수정한 최신 내용을 로컬 프로젝트 파일에서 덮어썼다는 점**이었습니다.

![오래된 Renderer Snapshot이 최신 SRT 자막을 덮어쓰는 순서](/images/electron-multi-window-shared-data-ssot/stale-snapshot-overwrite-sequence.png)

_오래된 Renderer Snapshot이 로컬 파일을 덮어쓰는 흐름_

이 문제는 단순한 화면 갱신 오류가 아니었습니다. 사용자가 작성한 결과가 이전 데이터로 덮어써지는 실제 데이터 유실 문제였습니다.

---

## 2. 원인 분석: 저장 실패가 아니라 오래된 Snapshot의 저장이었다

먼저 실제 값이 어떻게 달라졌는지부터 확인했습니다. 같은 SRT Row를 보고 있었지만, 각 Renderer가 가진 프로젝트 Store와 로컬 프로젝트 파일에는 서로 다른 값이 남아 있었습니다.

```text
1. 사용자가 SRT 자막을 수정한다.

SRT Script Panel Renderer
└─ Project Store A
   └─ “안녕하세요. 수정된 자막입니다.”

2. 다른 화면의 프로젝트 Store에는 수정 전 값이 남아 있다.

Editor Renderer
└─ Project Store B
   └─ “안녕하세요.”

Admin Renderer
└─ Project Store C
   └─ “안녕하세요.”

3. Editor 또는 Admin의 오래된 Snapshot으로 자동 저장이 실행된다.

Local Project File
└─ Project Snapshot D
   └─ “안녕하세요.”
```

구조를 추상화하면 네 곳이 같은 프로젝트 데이터의 복사본을 독립적으로 소유한 상태였습니다.

```text
SRT Script Panel Renderer ─ Project Store A ─ 최신 Snapshot
Editor Renderer           ─ Project Store B ─ 오래된 Snapshot
Admin Renderer            ─ Project Store C ─ 오래된 Snapshot
Local Project File        ─ Snapshot D       ─ 마지막으로 저장된 값
```

SRT Script Panel에서 자막을 수정하면 `Project Store A`에만 최신 값이 반영됐습니다. 이 상태에서 Editor 또는 Admin이 자동 저장을 요청하면, 저장 함수는 해당 Renderer가 전달한 오래된 Snapshot을 로컬 프로젝트 파일에 기록했습니다.

파일 I/O는 전달받은 값을 정상적으로 기록하고 있었습니다. 잘못된 것은 저장 동작이 아니라 저장 함수에 전달된 데이터였습니다.

즉, 디버깅의 초점은 다음 두 가지로 바뀌었습니다.

- 저장을 요청한 주체는 `SRT Script Panel Renderer`, `Editor Renderer`, `Admin Renderer` 중 어디였는가
- 요청에 포함된 Snapshot은 수정 전 값과 수정 후 값 중 무엇이었는가

예를 들어 로그에 `Editor Renderer → Project Store B → “안녕하세요.”`가 함께 기록되면, 저장 성공 여부와 별개로 수정 전 Snapshot이 전달됐다는 사실을 확인할 수 있습니다.

처음에는 화면 간 동기화 코드가 일부 누락된 문제라고 생각했습니다. 한 Renderer가 변경될 때 나머지 Renderer의 Store를 모두 갱신하면 해결할 수 있어 보였습니다.

```text
SRT Script Panel ↔ Editor
SRT Script Panel ↔ Admin
Editor           ↔ Admin
```

하지만 양방향 복사 경로를 모두 추가해도, 값이 서로 다를 때 무엇을 최신으로 판단할지 정하지 못합니다.

창이나 화면이 추가될 때마다 기존 Renderer와 새 Renderer 사이의 동기화 경로를 추가해야 합니다. 이벤트가 한 번이라도 누락되면 Store들은 다시 서로 다른 Snapshot을 갖게 됩니다. 여러 변경이 연속으로 발생하면 메시지 도착 순서와 저장 순서에 따라 결과가 달라질 수도 있습니다.

<p style="width: 100%; max-width: 400px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/temporary-fix-meme.jpg" alt="코드의 오류를 손바닥으로 막고 있는 임시방편을 표현한 밈" /></p>

_동기화가 누락될 때마다 IPC 하나씩 추가하는 방식은 기준점이 없는 문제를 해결하지 못했습니다._

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

```text
일반적인 React 애플리케이션
└─ 하나의 JavaScript 실행 환경
   └─ 하나의 Store 인스턴스

Electron 멀티 윈도우 애플리케이션
├─ BrowserWindow A
│  └─ Renderer Process A
│     └─ Store 인스턴스 A
└─ BrowserWindow B
   └─ Renderer Process B
      └─ Store 인스턴스 B
```

Electron 애플리케이션에는 Main Process와 Renderer Process가 있습니다. Main Process는 애플리케이션 진입점과 창의 생명주기를 관리하고, 각 `BrowserWindow`는 별도의 Renderer Process에서 웹 페이지를 실행합니다. 각 Renderer는 독립된 JavaScript 실행 환경과 메모리를 사용합니다. ([Electron](https://electronjs.org/docs/latest/tutorial/process-model 'Process Model'))

같은 Store 모듈을 import했다는 것은 각 JavaScript 실행 환경이 같은 생성 코드를 실행한다는 뜻입니다. Renderer 사이에서 메모리나 동일한 Store 인스턴스를 공유한다는 뜻은 아닙니다.

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

공유 데이터의 위치를 정하기 전에 기능 이름이 아니라 **데이터의 사용 방식과 보존 기간**을 기준으로 요구사항을 다시 정리했습니다.

### 여러 화면이 함께 사용하는 프로젝트 데이터

| 데이터                    | 사용하는 위치                   | 필요한 규칙                                      |
| ------------------------- | ------------------------------- | ------------------------------------------------ |
| 프로젝트 정보와 편집 결과 | Editor, Admin, 자동 저장        | 변경이 확정되면 관련 화면과 저장 대상에 반영     |
| SRT Row와 자막 내용       | SRT Script Panel, Editor, Admin | 실시간 변경을 관련 화면에 반영하고 파일에도 저장 |

메인 창의 작업 페이지들은 한 번에 하나만 활성화됐습니다. 반면 SRT Script Panel은 별도의 `BrowserWindow`로 분리할 수 있어 Editor 또는 Admin과 동시에 열릴 수 있었습니다. 따라서 같은 프로젝트 데이터를 여러 Renderer가 동시에 읽고 변경하는 경우를 고려해야 했습니다.

### 저장과 복구가 필요한 데이터

프로젝트 정보, SRT 자막, 편집 결과는 애플리케이션을 종료한 뒤에도 복구해야 했습니다. 자동 저장은 현재 확정된 프로젝트 전체를 로컬 프로젝트 파일에 기록해야 했고, 애플리케이션을 다시 실행할 때는 이 파일로 초기 상태를 복원해야 했습니다.

반면 실행 중에는 파일 쓰기가 완료되기 전에도 화면에 최신 변경을 보여줘야 했습니다. 따라서 실행 중인 최신 값과 앱 종료 후 복구할 값을 같은 것으로 취급하되, 각각 메모리와 파일에 보관할 필요가 있었습니다.

### 화면 생명주기와 무관하게 유지해야 하는 데이터

- 특정 창을 닫더라도 현재 프로젝트 데이터는 유지돼야 합니다.
- 새로 열린 창이나 나중에 활성화된 화면도 최신 데이터를 확인할 수 있어야 합니다.
- 열려 있는 관련 화면은 확정된 변경 결과를 전달받아야 합니다.
- 모든 저장 경로는 같은 최신 Snapshot을 사용해야 합니다.

정리하면 실행 중인 공유 데이터는 다음 조건을 충족해야 했습니다.

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

이 조건을 기준으로 보면 문제는 Store 간 복사 경로보다 데이터 소유권에 가까웠습니다. 먼저 최신 값을 확정할 주체를 정한 뒤, 각 화면과 로컬 프로젝트 파일이 그 값을 어떻게 전달받을지 설계해야 했습니다.

> 이 문제는 Store 간 동기화만 추가해서 끝나는 문제가 아니라, 모든 화면과 저장 기능이 따라야 할 단일 정보 공급원이 필요한 문제였습니다.

---

## 5. Local Project File을 SSOT로 사용할 수 없었던 이유

Renderer Store를 서로 직접 동기화하는 방법은 2절에서 제외했습니다. 남은 후보는 모든 Renderer가 하나의 로컬 프로젝트 파일을 기준으로 삼는 방법이었습니다.

```text
Renderer에서 변경
       ↓
로컬 파일에 저장
       ↓
다른 Renderer가 파일 다시 읽기
       ↓
화면 갱신
```

하나의 파일을 기준으로 값을 맞출 수 있다는 장점은 있습니다. 하지만 파일 읽기와 쓰기는 비동기로 완료되므로, 요청을 시작한 시점과 결과가 반환되는 시점 사이에 메모리의 프로젝트 상태가 다시 변경될 수 있습니다. 로컬 파일은 영속 데이터 보관에는 적합해도 실행 중인 최신 상태를 확정하는 주체로 사용하기에는 한계가 있었습니다.

- 연속된 입력마다 파일 읽기와 쓰기를 요청하면 화면 반영 시점이 파일 I/O 완료 시점에 묶입니다.
- 같은 파일을 대상으로 한 여러 쓰기의 시작 순서와 완료 순서를 별도로 제어해야 합니다.
- 현재 쓰기가 끝나기 전에 파일을 다시 읽으면 이전에 기록된 내용이 반환될 수 있습니다.
- Renderer마다 파일을 읽는 시점이 다르면 같은 순간에도 서로 다른 내용을 볼 수 있습니다.
- 파일 시스템이 영속 저장과 실행 중 상태 조정이라는 두 책임을 동시에 갖게 됩니다.

무엇보다 이번 문제는 오래된 Snapshot이 파일에 저장되면서 발생했습니다. 파일을 기준으로 삼더라도 어떤 Snapshot을 기록할지는 다른 주체가 결정해야 합니다.

따라서 로컬 프로젝트 파일은 영속 저장과 앱 재실행 시 복구에만 사용했습니다.

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

Editor가 닫혀도 Main Process의 현재 프로젝트 데이터는 유지할 수 있습니다. 이후 Admin이나 SRT Script Panel이 열리면 현재 Snapshot을 다시 전달할 수 있습니다.

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

예를 들어 SRT Script Panel에서 자막을 수정한 직후에는 세 위치의 값이 일시적으로 다를 수 있습니다.

```text
Main ProjectSession
└─ “안녕하세요. 수정된 자막입니다.”

Editor Renderer Cache
└─ “안녕하세요.”

Local Project File
└─ “안녕하세요.”
```

이때 Renderer Cache와 로컬 프로젝트 파일에 남은 값은 원본 후보가 아닙니다. 열린 Renderer에는 Main이 확정한 Snapshot을 전달하고, 로컬 프로젝트 파일에도 같은 Snapshot을 기록합니다. **값이 다를 때 Main의 `ProjectSession`을 기준으로 수렴시킨다**는 규칙이 이 구조에서 말하는 SSOT입니다.

| 위치                  | 역할                                             |
| --------------------- | ------------------------------------------------ |
| Main `ProjectSession` | 최신 Snapshot 결정과 프로젝트 변경 규칙 적용     |
| Renderer Cache        | 화면을 렌더링하기 위한 읽기 전용 로컬 복사본     |
| Local Project File    | 앱 종료 이후에도 데이터를 유지하고 복구하는 파일 |

---

## 7. ProjectSession 설계

SSOT의 위치를 정한 뒤에는 Main Process에서 현재 프로젝트 데이터를 어떤 형태로 관리할지 결정해야 했습니다.

Main Process에는 React 컴포넌트 트리가 없으므로 `useState`나 React Context처럼 렌더링을 전제로 하는 도구를 그대로 사용할 수 없습니다. Plain Object, Class private field, Vanilla Zustand를 검토했습니다.

### Plain Object

현재 프로젝트 데이터 보관만 필요하다면 일반 객체로도 충분합니다.

```ts
let currentProject: ProjectSnapshot = initialProjectSnapshot;
```

하지만 이번 구조에는 값 보관 외에도 다음 규칙이 필요했습니다.

- 현재 프로젝트 데이터 조회
- 변경 요청 검증과 적용
- 확정된 변경 결과 발행
- 외부 코드의 직접 변경 방지

Plain Object만으로도 구현할 수 있지만, 외부 코드가 값을 직접 바꾸지 못하게 제한하고 모든 변경 규칙을 한 경로로 모으려면 별도의 API 경계가 필요했습니다. 결국 객체를 어디에 보관하느냐보다 **누가 어떤 메서드로 변경할 수 있는지**가 더 중요한 요구사항이었습니다.

### Class

Class를 사용하면 외부에 허용할 변경 메서드만 공개할 수 있습니다.

```ts
projectSession.getDocument();
projectSession.dispatch(action);
```

프로젝트 데이터는 private field로 감추고, 조회와 변경 요청을 공개 메서드로 제한할 수 있습니다. 이를 통해 IPC Handler, 자동 저장, Renderer 갱신 코드가 private field를 직접 바꾸지 않고 같은 변경 경로를 사용하게 할 수 있었습니다.

### Vanilla Zustand

Zustand의 `createStore`는 React 없이 사용할 수 있는 Vanilla Store를 만듭니다. 생성된 Store는 `getState`, `setState`, `subscribe` API를 제공하므로 상태 보관과 Selector 기반 구독이 필요한 경우 사용할 수 있습니다. ([Zustand](https://zustand.docs.pmnd.rs/reference/apis/create-store 'createStore - Zustand'))

다만 당시 Main Process에서는 여러 소비자가 Selector로 일부 상태를 구독할 필요가 없었습니다. 변경 결과는 `dispatch`의 반환값으로 Project Event Publisher와 Autosave Coordinator에 전달할 수 있었고, 모든 변경을 `ProjectSession`의 메서드로 제한해야 했습니다.

| 기준          | Class private field   | Vanilla Zustand                    |
| ------------- | --------------------- | ---------------------------------- |
| 변경 API 제한 | public method로 제한  | `setState` 노출 범위를 별도로 제한 |
| Selector 구독 | 필요한 경우 직접 구현 | Store API로 제공                   |
| Middleware    | 필요한 경우 직접 구현 | 생태계를 활용할 수 있음            |
| 당시 요구사항 | 필요한 경계만 제공    | `ProjectSession` API와 기능이 겹침 |

따라서 초기 구조에서는 Vanilla Zustand를 Main의 저장소로 추가하지 않고, `ProjectSession`의 private field에 프로젝트 데이터를 보관했습니다. 별도의 Store API를 다시 감싸는 것보다 필요한 조회·변경 메서드만 공개하는 Class가 현재 요구사항에 더 작게 맞았습니다.

Main 내부에서 서로 다른 모듈이 독립적인 Selector 구독이나 Middleware를 요구하게 된다면 Vanilla Zustand를 다시 검토할 수 있습니다. 다만 이것은 미래 확장 기준이며, 현재 선택의 근거는 아니었습니다.

### ProjectSnapshot과 ProjectSession

Main Process에서 관리할 데이터는 크게 두 종류였습니다.

- 프로젝트 이름, 경로, 설정, 메타데이터처럼 자주 변경되지 않는 정보
- SRT Row, SRT 자막, 편집 결과처럼 실시간으로 변경되고 파일에 저장돼야 하는 정보

이 데이터를 하나의 `ProjectSnapshot`으로 묶었습니다. 아래 타입은 설명에 필요한 필드만 남긴 예시입니다. `version`은 Snapshot이 Main에서 확정된 순서를 나타내며, 다음 절에서 사용 방법을 설명합니다.

```ts
type ProjectSnapshot = {
  version: number;
  projectInfo: ProjectInfo;
  scriptRows: SrtRow[];
};
```

`ProjectSession`은 이 데이터를 private field에 보관하고 외부에는 조회와 변경 요청 API만 제공합니다. 변경의 순서를 구분하는 방법과 실제 `dispatch` 흐름은 다음 절에서 설명합니다.

저장과 Broadcast까지 `ProjectSession`이 직접 수행하게 하지는 않았습니다. Main 내부 책임은 다음과 같이 분리했습니다.

```text
ProjectSession
└─ 변경 검증과 ProjectSnapshot 갱신

Project Event Publisher
└─ 열린 Renderer에 확정 결과 발행

Autosave Coordinator
└─ Debouncing, pending Snapshot 교체, 파일 쓰기 순서, flush

Project Repository
└─ JSON 변환과 로컬 프로젝트 파일 교체

IPC Handler
└─ Preload에 노출할 API와 입력 검증 경계
```

이 분리로 `ProjectSession`은 파일 형식이나 Renderer Cache를 알지 않고, Repository는 언제 무엇을 저장할지 결정하지 않습니다.

---

## 8. Renderer 동기화와 자동 저장 흐름

### Version으로 변경 순서를 구분한다

Renderer의 IPC 응답, Main의 Broadcast, 비동기 Snapshot 요청은 전송을 시작한 순서와 다른 순서로 도착할 수 있습니다. 값만 비교해서는 어느 결과가 나중에 확정됐는지 판단할 수 없으므로 `ProjectSession`이 변경을 확정할 때마다 단조 증가하는 `version`을 함께 기록했습니다. 즉, `ProjectSnapshot`은 프로젝트 내용과 Main이 확정한 순서를 함께 표현합니다.

핵심 책임만 남긴 `ProjectSession` 예시는 다음과 같습니다.

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

예시에서 `applyProjectAction`은 요청을 검증하고 새 문서를 만드는 순수 함수이며, `createUpdateResult`는 확정된 Snapshot과 version을 응답 형태로 조립합니다. 변경 종류에 따라 forward patch와 inverse patch를 함께 만들면 Undo와 Redo도 각각 새로운 변경 요청으로 처리하고 History에 기록할 수 있습니다. 이 경우 되돌리기 전후의 순서 역시 새로운 version으로 구분합니다.

### Renderer는 변경을 요청하고 Main이 확정한다

기존에는 각 Renderer가 자신의 Store를 수정했고, 해당 Store의 값이 자동 저장에 사용될 수 있었습니다.

변경 후에는 Renderer가 프로젝트 데이터를 직접 확정하지 않습니다. Renderer는 사용자의 변경 의도를 `ProjectAction`으로 Main Process에 전달하고, Main이 요청을 검증한 뒤 Snapshot과 version을 확정합니다.

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

SRT Script Panel에서는 다음과 같이 변경을 요청합니다.

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

`baseVersion`은 Renderer가 어느 version을 기준으로 변경을 만들었는지 나타냅니다. Main의 현재 version과 다르다는 사실만으로 요청을 무조건 거절해야 하는 것은 아닙니다. 요청을 거절할지, 항목 단위로 충돌을 비교할지, 나중에 도착한 요청을 적용할지는 제품의 충돌 정책으로 별도로 정해야 합니다.

![Main Process에서 확정한 Snapshot을 파일 저장과 Renderer 화면 갱신에 사용하는 흐름](/images/electron-multi-window-shared-data-ssot/project-document-update-save-broadcast.png)

_Main Process에서 확정한 Snapshot을 파일 저장과 Renderer 화면 갱신에 사용하는 흐름_

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

사용자의 변경은 Main Process의 메모리 Snapshot에서 먼저 확정합니다. 디스크 쓰기는 비동기로 처리하되, 이전 Snapshot의 저장이 나중에 완료되면서 최신 파일을 다시 덮어쓰지 않도록 프로젝트별 파일 쓰기를 순서대로 실행합니다.

```text
사용자 입력
    ↓
Main Snapshot 즉시 변경
    ↓
Debounce 동안 pending Snapshot을 최신 값으로 교체
    ↓
같은 프로젝트의 파일 쓰기를 하나씩 실행
```

여기에는 세 가지 서로 다른 제어가 필요했습니다.

1. **Debouncing**: 입력이 이어지는 동안 저장 시작 시점을 뒤로 미뤄 불필요한 파일 쓰기를 줄입니다.
2. **Coalescing**: 저장을 기다리는 여러 Snapshot을 병합하지 않고, pending Snapshot 참조를 가장 최신 값으로 교체합니다.
3. **Queued sequential execution**: 같은 프로젝트 파일에 대한 비동기 쓰기는 한 번에 하나만 실행하고, 앞선 쓰기가 끝난 뒤 다음 쓰기를 시작합니다.

예를 들어 version 10을 저장하는 동안 version 11, 12, 13이 확정되면 11과 12를 각각 파일로 만들 필요는 없습니다. 진행 중인 version 10 쓰기가 끝난 뒤, 아직 저장하지 않은 최신 version 13을 기록하면 됩니다. 여기서 Coalescing은 여러 Snapshot의 내용을 합치는 merge가 아니라 **다음에 저장할 참조를 최신 Snapshot으로 교체하는 동작**입니다.

Queued sequential execution도 모든 프로젝트 변경을 직렬화한다는 뜻은 아닙니다. 메모리의 Snapshot과 version은 각 변경 요청을 처리할 때 확정하고, 같은 프로젝트 파일을 대상으로 한 비동기 쓰기만 대기열에서 하나씩 실행합니다.

### Renderer Cache는 화면 렌더링에 사용한다

Main Process의 Snapshot이 변경되면 Renderer 화면도 갱신돼야 합니다. 이 애플리케이션은 이미 프로젝트 조회 결과를 TanStack Query로 읽고 있었기 때문에, Renderer 전용 Store를 하나 더 만들지 않고 기존 Query Cache를 화면용 복사본으로 사용했습니다.

Renderer는 Main에서 확정 결과를 받고, 전달받은 Snapshot 또는 Patch를 TanStack Query Cache에 반영합니다.

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

React의 `useSyncExternalStore`는 React 컴포넌트가 React 외부 Store의 값을 읽고 변경을 구독하도록 연결하는 Hook입니다. Main의 저장소를 만들거나 Renderer 사이의 상태를 공유하는 API는 아닙니다. 이번 구조에서는 TanStack Query가 Cache 구독과 React 갱신을 이미 담당하므로 별도의 외부 Store와 `useSyncExternalStore`를 추가하지 않았습니다. ([React](https://react.dev/reference/react/useSyncExternalStore 'useSyncExternalStore'))

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

## 9. 일시적인 UI 이벤트 처리

### 저장하지 않는 이벤트는 별도 채널로 분리한다

프로젝트 데이터와 비슷해 보이지만 저장할 필요가 없는 이벤트도 있었습니다.

Editor에서 특정 Region을 클릭하면 SRT Script Panel에서 연결된 SRT Row를 Highlight하고, 해당 위치까지 스크롤해야 했습니다.

```text
Editor에서 Region 클릭
        ↓
SRT Script Panel의 Row Highlight
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
SRT Script Panel Renderer
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
- 오래된 Snapshot이 최신 SRT 자막을 덮어쓸 수 있었습니다.
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

이번 프로젝트를 하며 웹환경이 아닌 일렉트론에서 처음 만나는 문제들이 있었습니다. 그 중 가장 인상깊었던 것이 이 스토어구조를 설계한 이야기었습니다. 처음에는 당연히 렌더러 프로세스 안에 스토어를 가지고 있는 구조로 생각을 했는데, 로컬 저장기능을 하게 되면서 기준점이 두개로 나뉘어지고, 결국 단일 진실 공급원을 어디에 둬야하는가로 자연스럽게 사고가 이어졌던 것 같습니다.

저장을 하면서 변경한 내용이 바뀌게 되는 버그를 만나서 다시한번 단일 진실 공급원의 역할이 얼마나 중요한지 깨닫게 되었습니다.

또한 각 프로세스 내부에서 데이터를 어디에 저장할것인지, 전달은 어떻게 할 것인지를 고민해보며 각 상태 관리 도구들의 역할과 한계, useSyncExternalStore, Tanstack Query등의 도구들에 대해서도 다시한번 정리해보는 시간이 되었습니다. 이 문제를 풀면서 좀더 적절한 상태관리 구조와 도구에 대한 기준을 확립하게되어 좋은 경험이 되었다고 생각합니다.

사실 이렇게까지 깐깐하게 재고 따지지 않아도, 어쨌든 굴러가기만 하면 되는 것 아니냐는 뉘앙스의 이야기를 들었던 적도 있습니다. 실무를 하다보면 끝까지 파고들어 생각할 시간조차 주어지지않고 빠르게 빠르게 쳐내야만 할 때도 있는게 사실이라, 어느정도 동감하는 바가 있긴 합니다. 하지만, 이렇게 넘어가는 부분들이 결국 기술과 인지적 부채로 돌아온다는 것 또한 사실입니다.(특히 웹브라우저용 DAW 작업을 4번째 갈아엎으며 뼈저리게 깨달았습니다) 따라서 저는 처음부터 할 수 있는 한 엄밀하게 설계하여 만드는것이 시간을 절약해주는 길이라고 생각합니다.

모든 선택에 있어 "왜?" 라고 물었을때 답할 수 있는 설계를 지향하고, 나아갈 방향이라고 생각합니다. 아직 공부해야할 것이 너무 많지만, 올바른 방향으로 꾸준히 정진하는것이 가장 빠른 길이라는 것을 알기에 밟아야 할 모든 단계들을 감사한 마음으로 밟아나가고 싶습니다.
