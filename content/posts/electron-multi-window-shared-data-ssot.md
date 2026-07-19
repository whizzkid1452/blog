---
title: 'Electron에서는 공유 데이터를 어디에 둬야 할까?'
description: '멀티 윈도우 환경에서 오래된 Renderer 상태가 최신 작업을 덮어쓴 원인을 분석하고, Main Process를 공유 데이터의 SSOT로 설계한 과정을 정리합니다.'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00+09:00'
tags: ['electron', 'state-management', 'zustand', 'ssot', 'autosave']
draft: false
---

# Electron에서는 공유 데이터를 어디에 둬야 할까?

## 오래된 Renderer 상태가 최신 작업을 덮어쓴 원인과 Main Process를 SSOT로 설계한 과정

> **요약**  
> 각 Renderer가 프로젝트 데이터의 복사본을 독립적으로 관리하면서, 오래된 Snapshot이 자동 저장을 통해 최신 작업을 덮어썼습니다. 이 글에서는 Main Process가 최신 Snapshot을 확정하고 Renderer Cache와 로컬 파일이 그 결과를 사용하도록 상태의 역할을 나눈 과정을 설명합니다.

## 1. 오래된 Snapshot이 최신 작업을 덮어썼다

Electron으로 SRT 스크립트와 음성을 함께 편집하는 멀티미디어 에디터를 개발했습니다. Editor와 별도 창으로 분리한 SRT Script Panel에서 같은 프로젝트를 동시에 수정할 수 있었고, 변경된 데이터는 로컬 파일에 자동 저장됐습니다.

![동일 프로젝트를 편집하는 Editor와 분리된 SRT Script Panel](/images/electron-multi-window-shared-data-ssot/editor-srt-panel-browserwindows.png)

_BrowserWindow로 실행되는 Editor와 SRT Script Panel_

그러던 중 다음과 같은 제보가 들어왔습니다.

> “스크립트를 수정하고 점심을 먹고 오니까 수정한 내용이 사라졌어요!”

수정 직후 SRT Panel에는 최신 문장이 표시됐지만, 나중에 프로젝트를 다시 확인하면 수정 전 내용으로 돌아가 있었습니다. 로그상 자동 저장은 누락되거나 실패하지 않았습니다. 다른 Renderer에 남아 있던 이전 Snapshot이 정상적으로 저장되면서 최신 내용을 덮어쓰고 있었습니다.

![오래된 Renderer Snapshot이 최신 스크립트를 덮어쓰는 순서](/images/electron-multi-window-shared-data-ssot/stale-snapshot-overwrite-sequence.png)

_오래된 Renderer Snapshot이 로컬 파일을 덮어쓰는 흐름_

파일 I/O는 전달받은 값을 기록했습니다. 직접적인 문제는 저장 함수에 오래된 Snapshot이 전달된 것이었고, 이를 가능하게 한 구조적 조건은 같은 프로젝트 데이터를 여러 Renderer가 독립적으로 소유하면서도 최신 값을 확정할 주체가 없었다는 점이었습니다.

> 여러 창이 같은 데이터를 사용할 때, 누가 최종 상태를 확정해야 하는가?

자동 저장 주기보다 이 질문을 먼저 해결해야 했습니다.

---

## 2. 같은 Store 모듈도 Renderer가 다르면 상태를 공유하지 않는다

처음에는 모든 화면이 같은 Zustand Store 모듈을 import하면 상태도 공유할 수 있다고 생각했습니다.

```ts
import { useProjectStore } from './project-store';
```

하지만 같은 모듈을 import한다는 것은 같은 코드로 Store를 생성한다는 뜻이지, 동일한 Store 인스턴스를 공유한다는 뜻은 아닙니다.

Electron의 Main Process는 창의 생명주기 등을 관리하고, 각 `BrowserWindow`의 웹 페이지는 Renderer Process에서 실행됩니다. Renderer마다 JavaScript 실행 환경과 메모리가 분리되므로 각 창에서 생성한 Store도 별도 인스턴스입니다. ([Electron](https://electronjs.org/docs/latest/tutorial/process-model 'Process Model'))

```text
Main Process
 ├─ Editor Renderer
 │    └─ Project Store A
 └─ SRT Panel Renderer
      └─ Project Store B
```

![여러 Renderer Store와 Electron 프로세스 경계를 보여주는 AS-IS 구조](/images/electron-multi-window-shared-data-ssot/as-is-renderer-stores.png)

_변경 전 Store 인스턴스와 프로세스 경계_

React 애플리케이션에서 말하는 전역 Store는 하나의 JavaScript 실행 환경 안에서만 전역입니다. SRT Panel이 `Store A`를 수정해도 Editor의 `Store B`에는 이전 값이 남을 수 있습니다. 이 상태에서 `Store B`를 기준으로 자동 저장하면 파일에도 이전 값이 기록됩니다.

누락된 IPC를 추가해 Store끼리 복사하는 방법도 시도할 수 있습니다. 그러나 이벤트가 누락되거나 동시에 변경이 발생하면 어느 Store의 값을 신뢰할지 다시 결정해야 합니다. 동기화 경로를 늘리는 것만으로는 최신 값을 판단하는 기준이 생기지 않았습니다.

구조도에서는 핵심 데이터 흐름을 보여주기 위해 Preload Script를 생략했습니다. 실제 구현에서는 Renderer에 Electron API 전체를 노출하지 않고, Preload Script와 `contextBridge`를 통해 필요한 IPC API만 제공했습니다. ([Electron](https://electronjs.org/docs/latest/tutorial/ipc 'Inter-Process Communication'))

---

## 3. Main Process가 최신 값을 확정하도록 했다

공유 데이터는 다음 조건을 충족해야 했습니다.

- 여러 창에서 조회하거나 수정할 수 있어야 합니다.
- 특정 창을 닫아도 현재 프로젝트 데이터가 유지돼야 합니다.
- 새로 열린 창도 최신 데이터를 가져와야 합니다.
- 화면에 표시되는 값과 자동 저장되는 값이 같은 기준에서 나와야 합니다.

이 조건을 기준으로 세 가지 방법을 비교했습니다.

| 선택지                    | 한계 또는 선택 근거                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Renderer Store끼리 동기화 | 창이 늘수록 전달 경로가 증가하고, 누락된 이벤트만으로는 최신 값을 복구하기 어렵습니다. |
| 로컬 파일을 기준으로 사용 | 실시간 메모리 상태와 비동기 파일 쓰기의 완료 시점이 다릅니다.                          |
| Main Process에서 확정     | 창의 생명주기와 분리된 위치에서 변경과 자동 저장의 기준을 하나로 만들 수 있습니다.     |

로컬 파일을 실행 중인 기준으로 사용하면 연속된 입력마다 파일 읽기와 쓰기가 발생합니다. 파일 쓰기가 끝나기 전에 다시 읽으면 이전 값이 반환될 수도 있습니다. 무엇보다 어떤 Snapshot을 파일에 기록할지는 여전히 다른 주체가 결정해야 했습니다.

프로젝트 파일 저장과 Renderer 간 메시지 전달은 이미 Main Process를 통과하고 있었습니다. Main은 특정 Renderer가 닫혀도 유지되며, 나중에 열린 창에 현재 Snapshot을 제공할 수도 있습니다. 따라서 실행 중인 프로젝트 데이터의 최종 변경은 Main Process에서 확정하기로 했습니다.

![Main Process의 ProjectSession을 SSOT로 둔 TO-BE 구조](/images/electron-multi-window-shared-data-ssot/to-be-project-document-service.png)

_Main Process의 ProjectSession을 SSOT로 둔 구조_

여기서 단일 진실 공급원(Single Source of Truth, SSOT)은 데이터 복사본이 물리적으로 하나뿐이라는 뜻이 아닙니다. 값이 서로 다를 때 무엇을 기준으로 맞출지 결정하는 주체가 하나라는 뜻입니다.

Renderer에는 화면 렌더링을 위한 복사본이 존재합니다. 다만 프로젝트 데이터는 Main이 최종 확정하며, Main과 Renderer의 값이 다르면 Main의 Snapshot을 기준으로 맞춥니다.

---

## 4. 저장 데이터와 화면 상태의 경계를 나눴다

모든 상태를 Main Process로 옮기지는 않았습니다. 여러 창이 함께 사용하고 파일에 저장해야 하는 프로젝트 데이터만 Main에서 관리했습니다.

| 데이터 종류           | 예시                              | 관리 위치                      | 파일 저장 |
| --------------------- | --------------------------------- | ------------------------------ | --------- |
| 저장되는 공유 데이터  | SRT Row, 프로젝트 정보, 편집 결과 | Main의 `ProjectSession`        | 필요      |
| Renderer 내부 상태    | Modal, Filter, Hover              | React State 또는 Zustand Store | 불필요    |
| 일시적인 창 간 이벤트 | Highlight, Scroll, Selection      | IPC                            | 불필요    |

로컬 프로젝트 파일은 Main이 확정한 Snapshot을 앱 종료 후에도 보존하는 영속 저장소로만 사용했습니다.

예를 들어 Editor에서 Region을 선택했을 때 SRT Panel의 Row를 Highlight하는 동작은 창 사이에 전달돼야 하지만 프로젝트 데이터는 아닙니다. 앱을 다시 실행했을 때 복원할 필요가 없으므로 `ProjectSession`에 저장하지 않고 IPC 이벤트로 전달했습니다.

Main Process의 `ProjectSession`은 현재 `ProjectSnapshot`을 보관하고, 조회와 변경에 필요한 API만 외부에 제공합니다.

```ts
type ProjectSnapshot = {
  version: number;
  projectInfo: ProjectInfo;
  scriptRows: SrtRow[];
};

interface IProjectSession {
  getSnapshot(): ProjectSnapshot;
  dispatch(action: ProjectAction): ProjectUpdateResult;
  undo(): ProjectUpdateResult;
  redo(): ProjectUpdateResult;
}
```

실제 `ProjectSession` Class는 이 API를 구현하고 Snapshot을 private field로 감췄습니다. 모든 프로젝트 변경은 `dispatch`로 제한했습니다. 현재 요구사항은 Class의 field와 method만으로 충족할 수 있어 Main에 별도의 Zustand Store를 추가하지 않았습니다.

Main 내부 책임도 분리했습니다.

| 역할                    | 책임                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `ProjectSession`        | 변경 검증, Snapshot과 version 확정, Undo/Redo History 관리 |
| Autosave Coordinator    | Debounce, 최신 대기 Snapshot 유지, 파일 쓰기 순서 제어     |
| Project Repository      | JSON 변환과 로컬 프로젝트 파일 교체                        |
| Project Event Publisher | Main이 확정한 결과를 열린 Renderer에 전달                  |

`ProjectSession`은 파일 형식이나 Renderer Cache를 알지 않고, Project Repository는 언제 무엇을 저장할지 결정하지 않습니다. 각 모듈이 프로젝트 변경 확정, 저장 시점 조정, 파일 쓰기, 화면 갱신 중 한 가지 역할만 담당하도록 나눴습니다.

---

## 5. 변경·화면 갱신·자동 저장이 같은 Snapshot에서 시작한다

Renderer는 프로젝트 데이터를 직접 확정하지 않습니다. 사용자의 변경 의도를 `ProjectAction`으로 Main에 보내고, Main이 요청을 검증한 뒤 Snapshot과 version을 확정합니다.

```text
Renderer의 ProjectAction
          ↓
Main Process의 ProjectSession
          ↓ Snapshot과 version 확정
     ┌────┴─────┐
     ↓          ↓
자동 저장    Renderer 갱신
```

Renderer는 자신이 보고 있던 `baseVersion`과 고유한 `actionId`를 변경 요청에 포함합니다.

```ts
const updateResult = await window.project.dispatch({
  actionId: crypto.randomUUID(),
  baseVersion: projectSnapshot.version,
  type: 'srt-row-text-updated',
  payload: { rowId, text: nextText },
});
```

Main은 한 번 확정한 결과를 자동 저장과 Renderer 갱신에 함께 사용합니다.

```ts
ipcMain.handle('project:dispatch', (_event, action: ProjectAction) => {
  const updateResult = projectSession.dispatch(action);
  const snapshot = projectSession.getSnapshot();

  autosaveCoordinator.schedule(snapshot);
  projectEventPublisher.publish(updateResult);

  return updateResult;
});
```

이제 자동 저장은 특정 Renderer Store의 값을 받지 않습니다. 항상 Main이 확정한 Snapshot만 저장합니다.

메모리의 Snapshot과 version은 즉시 변경하고, 디스크 쓰기만 프로젝트별로 순차 실행했습니다. 저장 대기 중 새 변경이 들어오면 모든 중간 Snapshot을 파일로 만들지 않고 대기 중인 Snapshot 참조를 최신 값으로 교체했습니다. 이는 여러 Snapshot을 합치는 merge가 아니라, 저장하지 않은 중간 상태를 최신 상태로 대체하는 coalescing입니다.

```text
version 10 파일 쓰기 중
    ↓ version 11, 12, 13 확정
대기 Snapshot을 version 13으로 교체
    ↓ version 10 쓰기 완료
version 13 파일 쓰기 시작
```

이렇게 하면 이전 파일 쓰기가 늦게 끝나 최신 파일을 다시 덮어쓰지 않습니다. 모든 프로젝트 변경을 순차 실행한 것은 아닙니다. 메모리 변경은 동기적으로 확정하고, 같은 프로젝트 파일을 대상으로 하는 비동기 쓰기만 queued sequential execution으로 제한했습니다.

열려 있는 Renderer는 Main의 확정 결과를 받아 TanStack Query Cache를 갱신합니다. 이 Cache는 화면 렌더링을 위한 로컬 복사본이며, 프로젝트의 최종 상태를 확정하지 않습니다. 이미 받은 값을 동기적으로 반영할 때는 `setQueryData`를 사용하고 기존 Cache 객체를 직접 수정하지 않습니다. ([TanStack Query](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata 'QueryClient.setQueryData'))

나중에 열린 창은 이전 Broadcast를 받을 수 없으므로 Main의 현재 Snapshot을 다시 요청합니다. 비동기 요청과 Broadcast의 순서가 뒤바뀌더라도 오래된 값이 최신 Cache를 덮어쓰지 않도록 version을 비교합니다.

| 수신한 version             | 처리                                           |
| -------------------------- | ---------------------------------------------- |
| 현재 version 이하          | 중복되거나 오래된 결과이므로 무시              |
| 현재 version보다 1 큼      | 다음 확정 결과로 적용                          |
| 현재 version보다 2 이상 큼 | 중간 이벤트 누락으로 보고 Main Snapshot 재요청 |

이 규칙은 중복 전달, 순서 역전, 이벤트 누락을 구분합니다. 같은 항목을 여러 Renderer가 서로 다른 의도로 수정한 충돌까지 자동으로 해결하지는 않습니다. `baseVersion`이 현재 version과 다를 때 요청을 거절할지, 항목 단위로 비교할지는 제품에 맞는 별도의 충돌 정책이 필요합니다.

---

## 6. Store보다 데이터의 최종 결정권을 먼저 정해야 한다

변경 전에는 각 Renderer의 Snapshot이 화면과 자동 저장의 기준으로 사용될 수 있었습니다. 변경 후에는 Main Process의 `ProjectSession`만 최신 Snapshot을 확정하고, Renderer Cache와 자동 저장은 그 결과를 사용합니다.

| 위치                  | 역할                                                    |
| --------------------- | ------------------------------------------------------- |
| Main `ProjectSession` | 프로젝트 변경과 version을 확정하는 SSOT                 |
| Renderer Cache        | Main이 확정한 데이터를 화면에 표시하는 로컬 복사본      |
| Local Project File    | 앱 종료 후에도 확정된 프로젝트 데이터를 유지하는 저장소 |

이 구조는 이번 문제의 직접 원인이었던 오래된 Renderer Snapshot의 저장 경로를 제거했습니다. 다만 모든 상태 불일치나 동시 편집 충돌을 해결한다고 볼 수는 없습니다. 이벤트 누락은 version 비교와 재요청으로 복구하고, 의미적 충돌은 별도 정책으로 다뤄야 합니다.

처음에는 자동 저장 기능을 의심했습니다. 하지만 저장은 실패하지 않았습니다. 최신 값을 결정할 기준이 없는 상태에서 오래된 데이터를 정상적으로 저장하고 있었습니다.

> 어떤 Store를 사용할 것인가보다, 값이 다를 때 누구의 데이터를 신뢰할 것인가를 먼저 정해야 합니다.

이번 프로젝트에서는 저장되는 공유 데이터의 결정권을 Main Process에 두었습니다. TanStack Query Cache는 화면 표시를, React State와 Zustand Store는 Renderer 내부 상태를, IPC는 저장하지 않는 창 간 이벤트를 담당하도록 경계를 나눴습니다.

핵심은 모든 상태를 한곳에 모으는 것이 아닙니다. 저장되는 데이터와 화면 상태를 구분하고, 공유 데이터의 최신 값을 확정하는 주체를 하나로 정하는 것입니다.
