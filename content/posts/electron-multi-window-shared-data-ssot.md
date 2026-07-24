---
title: '[Part 1.] Electron 멀티 윈도우 공유 데이터 동기화 구현하기'
description: 'Main Process의 ProjectSession을 기준으로 ProjectAction, IPC, Renderer Cache, 자동 저장을 연결하는 구현 과정을 단계별로 정리합니다.'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00+09:00'
tags: ['electron', 'state-management', 'ipc', 'ssot', 'autosave']
series:
  name: 'Electron 멀티 윈도우 공유 데이터'
  order: 1
draft: false
---

Electron 멀티 윈도우 환경에서 각 Renderer가 프로젝트 Store를 따로 소유하면 같은 프로젝트의 Snapshot이 서로 달라질 수 있습니다. 제가 개발한 SRT 편집기에서는 한 Renderer에 남아 있던 수정 전 Snapshot이 자동 저장되면서, 다른 Renderer에서 수정한 최신 자막을 덮어쓴 적이 있었습니다.

이 글에서는 판단 과정을 짧게 줄이고 **Main Process의 `ProjectSession`을 기준으로 공유 데이터를 동기화하는 구현**에 집중합니다. Main Process를 선택한 판단 근거와 대안 비교는 [[Part 2.] Electron에서는 공유 데이터를 어디에 둬야 할까?](/posts/electron-main-process-ssot-decision)에서 다룹니다.

아래 코드는 구조를 설명하기 위해 SRT Row 수정만 남긴 최소 TypeScript 예제입니다. 실제 프로젝트의 전체 소스 코드를 그대로 옮긴 것은 아닙니다. 특히 충돌 정책은 제품 요구사항에 따라 달라질 수 있으므로, 이 예제에서는 동작을 명확히 검증할 수 있는 보수적인 정책을 별도로 정의합니다.

또한 이 예제는 애플리케이션 전체에서 현재 프로젝트가 하나라는 전제를 사용합니다. 여러 프로젝트를 동시에 열 수 있다면 Main에서 `projectId`별 `ProjectSession`과 자동 저장 Queue를 관리해야 합니다.

---

## [sort1] 1. 구현 목표부터 고정한다

먼저 데이터 흐름을 하나로 제한했습니다.

```text
Renderer
   ↓ ProjectAction
Main IPC Handler
   ↓
ProjectApplicationService
   ↓
ProjectSession
   ├─ Snapshot과 version 확정
   ├─ Project Event Publisher → 열린 Renderer
   └─ Autosave Coordinator → Local Project File
```

![Main Process의 ProjectSession을 기준으로 공유 데이터를 동기화하는 구조](/images/electron-multi-window-shared-data-ssot/to-be-project-document-service.png)

_Main Process의 ProjectSession을 기준으로 연결한 구조_

구현에서 지킬 규칙은 네 가지입니다.

1. Renderer는 프로젝트 Snapshot을 직접 저장하지 않고 변경 의도인 `ProjectAction`만 전달합니다.
2. `ProjectSession`만 프로젝트 Snapshot과 `version`을 변경합니다.
3. 화면 갱신과 자동 저장은 Main이 확정한 동일한 Snapshot을 사용합니다.
4. Renderer Cache는 화면 표시용 복사본이며, 더 낮은 `version`으로 되돌아가지 않습니다.

역할도 먼저 분리했습니다.

| 모듈                         | 책임                                                 |
| ---------------------------- | ---------------------------------------------------- |
| `ProjectSession`             | 변경 검증, Snapshot 갱신, `version` 증가             |
| `ProjectApplicationService`  | 변경 결과를 발행하고 자동 저장을 예약                |
| `ProjectEventPublisher`      | 열린 Renderer에 확정된 Snapshot 전달                 |
| `ProjectAutosaveCoordinator` | Debouncing, Coalescing, 파일 쓰기 순서 제어, `flush` |
| `ProjectRepository`          | Snapshot 직렬화와 로컬 파일 교체                     |
| IPC Handler                  | Renderer 입력 검증과 Application Service 호출        |
| Preload API                  | Renderer에 허용할 IPC 기능만 노출                    |

`ProjectSession`이 파일 저장과 IPC까지 직접 처리하지 않는 이유는 테스트 경계를 작게 유지하기 위해서입니다. Session 테스트에서는 Electron과 파일 시스템을 준비하지 않고도 변경 규칙만 검증할 수 있습니다.

---

## [sort1] 2. 공유 계약을 먼저 정의한다

Main, Preload, Renderer가 같은 계약을 사용하도록 프로젝트 타입을 별도 모듈에 둡니다.

```ts
// shared/project-types.ts
export interface SrtRow {
  id: string;
  text: string;
}

export interface ProjectDocument {
  projectId: string;
  scriptRows: SrtRow[];
}

export interface ProjectSnapshot extends ProjectDocument {
  version: number;
}

export interface UpdateSrtRowTextAction {
  actionId: string;
  baseVersion: number;
  type: 'srt-row-text-updated';
  payload: {
    rowId: string;
    text: string;
  };
}

export type ProjectAction = UpdateSrtRowTextAction;

export interface ProjectUpdateResult {
  actionId: string;
  previousVersion: number;
  snapshot: ProjectSnapshot;
}
```

여기서 `version`과 `baseVersion`의 의미를 구분해야 합니다.

- `version`: Main이 Snapshot을 확정한 순서입니다.
- `baseVersion`: Renderer가 변경 요청을 만들 때 읽고 있던 Snapshot의 `version`입니다.

`baseVersion`이 다르면 Renderer가 이전 Snapshot을 기준으로 요청을 만들었다는 사실은 알 수 있습니다. 하지만 두 요청이 서로 다른 Row를 수정했다면 의미상 충돌하지 않을 수도 있습니다. 따라서 `baseVersion` 불일치는 **의미상 충돌의 증명**이 아니라 충돌 가능성을 감지하는 조건입니다.

이 글의 최소 예제에서는 정책을 단순하게 검증하기 위해 `baseVersion !== currentVersion`이면 요청을 거절합니다. 실제 편집기에서 Row 단위 병합이나 Last Write Wins가 필요하다면 `ProjectSession`의 검증 정책만 교체해야 합니다.

---

## [sort1] 3. ProjectSession을 테스트로 고정한다

구현 전에 Session이 보장해야 할 동작을 테스트로 작성했습니다.

### [sort2] 3-1. 변경을 확정하면 version이 증가한다

```ts
// main/project-session.test.ts
import { describe, expect, it } from 'vitest';

import { ProjectSession, VersionConflictError } from './project-session';

const initialSnapshot = {
  projectId: 'project-1',
  version: 3,
  scriptRows: [{ id: 'row-1', text: '안녕하세요.' }],
};

describe('ProjectSession', () => {
  it('SRT Row 변경을 확정하고 version을 1 증가시킨다', () => {
    const projectSession = new ProjectSession(initialSnapshot);

    const updateResult = projectSession.dispatch({
      actionId: 'action-1',
      baseVersion: 3,
      type: 'srt-row-text-updated',
      payload: {
        rowId: 'row-1',
        text: '수정된 자막입니다.',
      },
    });

    expect(updateResult.previousVersion).toBe(3);
    expect(updateResult.snapshot.version).toBe(4);
    expect(updateResult.snapshot.scriptRows[0].text).toBe('수정된 자막입니다.');
  });

  it('외부에서 조회한 Snapshot을 변경해도 내부 상태는 바뀌지 않는다', () => {
    const projectSession = new ProjectSession(initialSnapshot);
    const exposedSnapshot = projectSession.getSnapshot();

    exposedSnapshot.scriptRows[0].text = '외부에서 변경한 값';

    expect(projectSession.getSnapshot().scriptRows[0].text).toBe('안녕하세요.');
  });

  it('이전 version을 기준으로 만든 요청은 거절한다', () => {
    const projectSession = new ProjectSession(initialSnapshot);

    expect(() =>
      projectSession.dispatch({
        actionId: 'action-2',
        baseVersion: 2,
        type: 'srt-row-text-updated',
        payload: {
          rowId: 'row-1',
          text: '오래된 요청',
        },
      })
    ).toThrow(VersionConflictError);
  });
});
```

첫 번째 테스트는 변경 내용과 순서를 함께 검증합니다. 두 번째 테스트는 조회 API로 받은 객체를 외부에서 수정해도 Session 내부 원본이 바뀌지 않아야 한다는 조건을 검증합니다. 세 번째 테스트는 이 예제에서 선택한 충돌 정책을 고정합니다.

### [sort2] 3-2. 순수 함수와 Session을 분리한다

프로젝트 변경 계산은 파일 I/O가 없는 순수 함수로 작성합니다.

```ts
// main/apply-project-action.ts
import type { ProjectAction, ProjectDocument, ProjectSnapshot } from '../shared/project-types';

export function applyProjectAction(snapshot: ProjectSnapshot, action: ProjectAction): ProjectDocument {
  switch (action.type) {
    case 'srt-row-text-updated':
      return updateSrtRowText(snapshot, action.payload);
    default:
      return assertNever(action);
  }
}

interface UpdateSrtRowTextPayload {
  rowId: string;
  text: string;
}

function updateSrtRowText(snapshot: ProjectSnapshot, payload: UpdateSrtRowTextPayload): ProjectDocument {
  const hasTargetRow = snapshot.scriptRows.some(scriptRow => scriptRow.id === payload.rowId);

  if (!hasTargetRow) {
    throw new Error(`SRT Row를 찾을 수 없습니다: ${payload.rowId}`);
  }

  return {
    projectId: snapshot.projectId,
    scriptRows: snapshot.scriptRows.map(scriptRow =>
      scriptRow.id === payload.rowId ? { ...scriptRow, text: payload.text } : scriptRow
    ),
  };
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 ProjectAction입니다: ${JSON.stringify(value)}`);
}
```

`applyProjectAction`은 다음 `ProjectDocument`만 계산합니다. `version` 증가는 Main에서 변경 순서를 확정하는 `ProjectSession`의 책임으로 남깁니다. `assertNever`는 `ProjectAction` 종류를 추가하고 `switch` 처리를 빠뜨리면 TypeScript가 누락을 드러내도록 만드는 exhaustive check입니다.

### [sort2] 3-3. private field를 가진 Session을 구현한다

```ts
// main/project-session.ts
import type { ProjectAction, ProjectSnapshot, ProjectUpdateResult } from '../shared/project-types';
import { applyProjectAction } from './apply-project-action';

export class VersionConflictError extends Error {
  constructor(
    readonly baseVersion: number,
    readonly currentVersion: number
  ) {
    super(`프로젝트 version이 일치하지 않습니다: ${baseVersion} !== ${currentVersion}`);
    this.name = 'VersionConflictError';
  }
}

export class ProjectSession {
  private currentSnapshot: ProjectSnapshot;

  constructor(initialSnapshot: ProjectSnapshot) {
    this.currentSnapshot = structuredClone(initialSnapshot);
  }

  getSnapshot(): ProjectSnapshot {
    return structuredClone(this.currentSnapshot);
  }

  dispatch(action: ProjectAction): ProjectUpdateResult {
    this.assertCurrentVersion(action.baseVersion);

    const previousVersion = this.currentSnapshot.version;
    const nextDocument = applyProjectAction(this.currentSnapshot, action);

    this.currentSnapshot = {
      ...nextDocument,
      version: previousVersion + 1,
    };

    return {
      actionId: action.actionId,
      previousVersion,
      snapshot: this.getSnapshot(),
    };
  }

  private assertCurrentVersion(baseVersion: number): void {
    const currentVersion = this.currentSnapshot.version;

    if (baseVersion !== currentVersion) {
      throw new VersionConflictError(baseVersion, currentVersion);
    }
  }
}
```

`structuredClone`은 반환된 객체와 Session 내부 객체의 참조를 분리하기 위해 사용했습니다. 이것은 객체를 불변으로 만드는 `freeze`가 아닙니다. 외부 코드가 반환된 복사본을 수정할 수는 있지만, 그 수정이 Session 내부 Snapshot에는 반영되지 않습니다.

---

## [sort1] 4. 변경 확정 이후의 작업을 Application Service에서 연결한다

`ProjectSession`은 변경만 확정합니다. 확정된 결과의 발행과 자동 저장 예약은 조정 계층에서 연결합니다.

```ts
// main/project-application-service.ts
import type { ProjectAction, ProjectSnapshot, ProjectUpdateResult } from '../shared/project-types';
import type { ProjectAutosaveCoordinator } from './project-autosave-coordinator';
import type { ProjectEventPublisher } from './project-event-publisher';
import type { ProjectSession } from './project-session';

interface ProjectApplicationServiceOptions {
  projectSession: ProjectSession;
  projectEventPublisher: ProjectEventPublisher;
  projectAutosaveCoordinator: ProjectAutosaveCoordinator;
}

export class ProjectApplicationService {
  private readonly projectSession: ProjectSession;
  private readonly projectEventPublisher: ProjectEventPublisher;
  private readonly projectAutosaveCoordinator: ProjectAutosaveCoordinator;

  constructor(options: ProjectApplicationServiceOptions) {
    this.projectSession = options.projectSession;
    this.projectEventPublisher = options.projectEventPublisher;
    this.projectAutosaveCoordinator = options.projectAutosaveCoordinator;
  }

  getSnapshot(): ProjectSnapshot {
    return this.projectSession.getSnapshot();
  }

  dispatch(action: ProjectAction): ProjectUpdateResult {
    const updateResult = this.projectSession.dispatch(action);

    this.projectEventPublisher.publish(updateResult.snapshot);
    this.projectAutosaveCoordinator.schedule(updateResult.snapshot);

    return updateResult;
  }

  flush(): Promise<void> {
    return this.projectAutosaveCoordinator.flush();
  }
}
```

이 순서에서 메모리 Snapshot의 확정은 동기적으로 끝납니다. Renderer event 발행과 자동 저장은 이미 확정된 동일한 Snapshot을 입력으로 받습니다.

파일 저장이 완료되기 전이므로 `dispatch` 성공을 “디스크 저장 완료”로 표현하면 안 됩니다. 이 결과가 보장하는 것은 Main 메모리에서 변경이 확정됐다는 사실입니다. 저장 완료 상태가 UI에 필요하다면 `memoryVersion`과 `diskSavedVersion`을 별도로 관리해야 합니다.

---

## [sort1] 5. Main과 Renderer 사이에 좁은 IPC API를 만든다

Renderer에 Electron의 `ipcRenderer` 전체를 노출하지 않고, 프로젝트 기능에 필요한 API만 Preload에서 감쌉니다. Electron 공식 문서도 `contextBridge`를 통해 제한된 메서드를 노출하는 방식을 안내합니다. ([Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), [contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge))

### [sort2] 5-1. Main에서 IPC Handler를 등록한다

Renderer 입력은 TypeScript 타입만으로 검증되지 않습니다. IPC 경계를 통과한 값의 구조를 런타임에 확인해야 합니다.

```ts
// main/parse-project-action.ts
import type { ProjectAction } from '../shared/project-types';

export function parseProjectAction(input: unknown): ProjectAction {
  if (!isRecord(input) || input.type !== 'srt-row-text-updated') {
    throw new TypeError('지원하지 않는 ProjectAction입니다.');
  }

  if (
    typeof input.actionId !== 'string' ||
    !Number.isInteger(input.baseVersion) ||
    !isRecord(input.payload) ||
    typeof input.payload.rowId !== 'string' ||
    typeof input.payload.text !== 'string'
  ) {
    throw new TypeError('ProjectAction 형식이 올바르지 않습니다.');
  }

  return {
    actionId: input.actionId,
    baseVersion: input.baseVersion as number,
    type: 'srt-row-text-updated',
    payload: {
      rowId: input.payload.rowId,
      text: input.payload.text,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

`Number.isInteger` 검사 뒤에도 `Record<string, unknown>`의 속성 타입은 자동으로 `number`로 고정되지 않을 수 있어 예제에서는 마지막 조립 시 타입을 명시했습니다. 실제 프로젝트에서 이미 Zod 같은 Schema Validator를 사용한다면 이 수동 Parser를 Schema로 대체할 수 있습니다.

```ts
// main/register-project-ipc.ts
import { ipcMain } from 'electron';

import type { ProjectApplicationService } from './project-application-service';
import { parseProjectAction } from './parse-project-action';

const GET_PROJECT_SNAPSHOT_CHANNEL = 'project:get-snapshot';
const DISPATCH_PROJECT_ACTION_CHANNEL = 'project:dispatch';

export function registerProjectIpc(projectApplicationService: ProjectApplicationService): void {
  ipcMain.handle(GET_PROJECT_SNAPSHOT_CHANNEL, () => projectApplicationService.getSnapshot());

  ipcMain.handle(DISPATCH_PROJECT_ACTION_CHANNEL, (_event, input: unknown) => {
    const action = parseProjectAction(input);
    return projectApplicationService.dispatch(action);
  });
}
```

`ipcRenderer.invoke`로 보낸 요청은 `ipcMain.handle`에서 처리하고 반환값을 Promise 결과로 받을 수 있습니다. ([Electron ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer), [ipcMain](https://www.electronjs.org/docs/latest/api/ipc-main))

위 Parser는 Payload 구조만 확인합니다. 애플리케이션이 외부 콘텐츠를 로드하거나 창마다 권한이 다르다면 `event.sender`가 허용된 창인지 확인하는 인가 규칙도 IPC Handler에 추가해야 합니다.

### [sort2] 5-2. Main이 확정한 Snapshot을 열린 창에 발행한다

```ts
// main/project-event-publisher.ts
import { BrowserWindow } from 'electron';

import type { ProjectSnapshot } from '../shared/project-types';

export const PROJECT_UPDATED_CHANNEL = 'project:updated';

export interface ProjectEventPublisher {
  publish(snapshot: ProjectSnapshot): void;
}

export class ElectronProjectEventPublisher implements ProjectEventPublisher {
  publish(snapshot: ProjectSnapshot): void {
    for (const browserWindow of BrowserWindow.getAllWindows()) {
      if (browserWindow.isDestroyed()) {
        continue;
      }

      browserWindow.webContents.send(PROJECT_UPDATED_CHANNEL, snapshot);
    }
  }
}
```

`webContents.send`는 Main에서 Renderer로 비동기 메시지를 보냅니다. 전달 인자는 Structured Clone Algorithm으로 직렬화되므로 함수나 Promise 같은 값은 보낼 수 없습니다. ([Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents))

현재 예제는 모든 `BrowserWindow`에 Snapshot을 보냅니다. 프로젝트가 여러 개 열릴 수 있다면 창과 `projectId`의 관계를 Main에서 관리하고, 해당 프로젝트를 구독한 창에만 발행해야 합니다.

### [sort2] 5-3. Preload에서 허용된 기능만 노출한다

```ts
// preload/project-api.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

import type { ProjectAction, ProjectSnapshot, ProjectUpdateResult } from '../shared/project-types';

const GET_PROJECT_SNAPSHOT_CHANNEL = 'project:get-snapshot';
const DISPATCH_PROJECT_ACTION_CHANNEL = 'project:dispatch';
const PROJECT_UPDATED_CHANNEL = 'project:updated';

export interface ProjectApi {
  getSnapshot(): Promise<ProjectSnapshot>;
  dispatch(action: ProjectAction): Promise<ProjectUpdateResult>;
  onUpdated(listener: (snapshot: ProjectSnapshot) => void): () => void;
}

const projectApi: ProjectApi = {
  getSnapshot: () => ipcRenderer.invoke(GET_PROJECT_SNAPSHOT_CHANNEL),
  dispatch: action => ipcRenderer.invoke(DISPATCH_PROJECT_ACTION_CHANNEL, action),
  onUpdated: listener => {
    const handleUpdated = (_event: IpcRendererEvent, snapshot: ProjectSnapshot): void => {
      listener(snapshot);
    };

    ipcRenderer.on(PROJECT_UPDATED_CHANNEL, handleUpdated);

    return () => {
      ipcRenderer.removeListener(PROJECT_UPDATED_CHANNEL, handleUpdated);
    };
  },
};

contextBridge.exposeInMainWorld('projectApi', projectApi);
```

구독 해제 함수는 등록할 때 사용한 `handleUpdated` 참조를 그대로 제거합니다. 익명 함수를 다시 만들어 `removeListener`에 전달하면 기존 Listener가 제거되지 않습니다.

Renderer에서 타입을 사용할 수 있도록 전역 선언도 추가합니다.

```ts
// renderer/global.d.ts
import type { ProjectApi } from '../preload/project-api';

declare global {
  interface Window {
    projectApi: ProjectApi;
  }
}

export {};
```

---

## [sort1] 6. Renderer Cache는 version을 비교한 뒤 갱신한다

Main의 응답과 Broadcast는 도착 순서가 달라질 수 있습니다. 같은 변경에 대한 `dispatch` 응답과 `project:updated` event를 모두 받아도, 더 높은 `version`만 적용하면 Cache가 과거 Snapshot으로 되돌아가지 않습니다.

### [sort2] 6-1. 확정된 Snapshot을 Cache에 반영한다

```ts
// renderer/apply-confirmed-snapshot.ts
import type { QueryClient } from '@tanstack/react-query';

import type { ProjectSnapshot } from '../shared/project-types';

export function applyConfirmedSnapshot(queryClient: QueryClient, incomingSnapshot: ProjectSnapshot): void {
  queryClient.setQueryData<ProjectSnapshot>(['project', incomingSnapshot.projectId], currentSnapshot => {
    if (currentSnapshot && incomingSnapshot.version <= currentSnapshot.version) {
      return currentSnapshot;
    }

    return incomingSnapshot;
  });
}
```

TanStack Query의 `setQueryData`는 이미 확보한 데이터를 Cache에 동기적으로 반영합니다. 기존 Cache 객체를 직접 수정하지 않고 새 Snapshot을 반환해야 합니다. ([TanStack Query](https://tanstack.com/query/latest/docs/reference/QueryClient))

`incomingVersion <= currentVersion`일 때 무시하는 규칙은 중복 event와 늦게 도착한 이전 결과를 처리합니다. 그러나 중간 version의 event가 누락된 사실까지 복구하지는 않습니다. Patch만 전달하는 구조에서는 version 간격이 생기면 전체 Snapshot을 다시 조회해야 합니다. 이 예제처럼 매번 전체 Snapshot을 전달한다면 가장 높은 version 하나만 적용해도 현재 문서를 복원할 수 있습니다.

### [sort2] 6-2. 화면 진입 시 조회하고 event를 구독한다

```ts
// renderer/use-project-snapshot.ts
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProjectSnapshot } from '../shared/project-types';
import { applyConfirmedSnapshot } from './apply-confirmed-snapshot';

export function useProjectSnapshot(projectId: string) {
  const queryClient = useQueryClient();
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => window.projectApi.getSnapshot(),
  });

  useEffect(() => {
    return window.projectApi.onUpdated(snapshot => {
      if (snapshot.projectId !== projectId) {
        return;
      }

      applyConfirmedSnapshot(queryClient, snapshot);
    });
  }, [projectId, queryClient]);

  return projectQuery;
}
```

새로 열린 창은 과거 event를 받지 못합니다. 따라서 화면 진입 시 Main의 현재 Snapshot을 먼저 조회하고, 이후 변경 event를 구독합니다.

조회와 구독 사이에 변경이 발생할 수 있으므로 최종 일관성은 `version` 비교가 담당합니다. 더 강한 보장이 필요하면 Main에 구독 등록과 초기 Snapshot 전달을 하나의 절차로 묶거나, 구독 직후 Snapshot을 다시 조회해야 합니다.

### [sort2] 6-3. Renderer는 Snapshot이 아니라 Action을 보낸다

```ts
// renderer/update-srt-row-text.ts
import type { QueryClient } from '@tanstack/react-query';

import type { ProjectSnapshot } from '../shared/project-types';
import { applyConfirmedSnapshot } from './apply-confirmed-snapshot';

interface UpdateSrtRowTextOptions {
  queryClient: QueryClient;
  projectId: string;
  rowId: string;
  text: string;
}

export async function updateSrtRowText(options: UpdateSrtRowTextOptions): Promise<void> {
  const queryKey = ['project', options.projectId] as const;
  const currentSnapshot = options.queryClient.getQueryData<ProjectSnapshot>(queryKey);

  if (!currentSnapshot) {
    throw new Error('프로젝트 Snapshot을 먼저 조회해야 합니다.');
  }

  try {
    const updateResult = await window.projectApi.dispatch({
      actionId: crypto.randomUUID(),
      baseVersion: currentSnapshot.version,
      type: 'srt-row-text-updated',
      payload: {
        rowId: options.rowId,
        text: options.text,
      },
    });

    applyConfirmedSnapshot(options.queryClient, updateResult.snapshot);
  } catch (error) {
    await options.queryClient.invalidateQueries({ queryKey });
    throw error;
  }
}
```

이 예제는 Main의 확정 결과를 받은 뒤 화면을 갱신합니다. Optimistic Update가 필요하다면 Renderer Cache를 먼저 바꿀 수 있지만, 실패 시 Rollback 규칙이 추가로 필요합니다. Optimistic Cache는 예상 결과일 뿐이므로 자동 저장의 입력으로 사용하면 안 됩니다.

또한 Electron IPC를 통해 전달된 Main의 `Error` 인스턴스는 Renderer에서 같은 Class 인스턴스로 유지되지 않습니다. 예상 가능한 충돌을 오류 코드별로 처리해야 한다면 `{ ok, data, error }` 형태의 직렬화 가능한 응답 계약을 정의하는 편이 명확합니다.

---

## [sort1] 7. 자동 저장은 최신 pending Snapshot만 기록한다

자동 저장의 입력도 Renderer Store가 아니라 `ProjectSession`이 확정한 Snapshot으로 제한합니다.

```text
사용자 입력
    ↓
Main Snapshot 즉시 확정
    ↓
Debounce 동안 pending Snapshot을 최신 값으로 교체
    ↓
같은 프로젝트 파일의 비동기 쓰기를 하나씩 실행
```

여기에는 서로 다른 세 가지 제어가 필요합니다.

- **Debouncing**: 입력이 계속되면 저장 시작 시점을 뒤로 미룹니다.
- **Coalescing**: 대기 중인 Snapshot을 모두 저장하지 않고 가장 높은 최신 Snapshot으로 교체합니다.
- **Queued sequential execution**: 같은 프로젝트 파일의 비동기 쓰기를 한 번에 하나만 실행합니다.

Queued sequential execution은 모든 프로젝트 변경을 순차 실행한다는 뜻이 아닙니다. 메모리 변경은 요청마다 즉시 확정하고, 같은 파일을 대상으로 하는 비동기 쓰기만 겹치지 않게 실행합니다.

### [sort2] 7-1. Coalescing 동작을 먼저 테스트한다

version 10을 저장하는 동안 11, 12, 13이 확정됐다면, 진행 중인 10을 중단하지 않고 다음 저장 대상으로 13만 남깁니다.

```ts
// main/project-autosave-coordinator.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { ProjectSnapshot } from '../shared/project-types';
import { ProjectAutosaveCoordinator } from './project-autosave-coordinator';

function createSnapshot(version: number): ProjectSnapshot {
  return {
    projectId: 'project-1',
    version,
    scriptRows: [{ id: 'row-1', text: `version-${version}` }],
  };
}

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

describe('ProjectAutosaveCoordinator', () => {
  it('진행 중인 쓰기 뒤에는 가장 최신 pending Snapshot만 저장한다', async () => {
    vi.useFakeTimers();

    const firstWrite = createDeferred();
    const savedVersions: number[] = [];
    const repository = {
      save: vi.fn(async (snapshot: ProjectSnapshot) => {
        savedVersions.push(snapshot.version);

        if (snapshot.version === 10) {
          await firstWrite.promise;
        }
      }),
    };
    const coordinator = new ProjectAutosaveCoordinator({
      delayMs: 100,
      repository,
      onError: error => {
        throw error;
      },
    });

    coordinator.schedule(createSnapshot(10));
    await vi.runOnlyPendingTimersAsync();

    coordinator.schedule(createSnapshot(11));
    coordinator.schedule(createSnapshot(12));
    coordinator.schedule(createSnapshot(13));
    await vi.runOnlyPendingTimersAsync();

    firstWrite.resolve();
    await coordinator.flush();

    expect(savedVersions).toEqual([10, 13]);
    vi.useRealTimers();
  });
});
```

이 테스트가 검증하는 것은 저장 횟수 자체가 아니라 저장 순서입니다. version 10 뒤에 version 13이 기록되므로, 늦게 끝난 이전 쓰기가 최신 파일을 다시 덮어쓰는 경로를 차단합니다.

### [sort2] 7-2. Autosave Coordinator를 구현한다

```ts
// main/project-autosave-coordinator.ts
import type { ProjectSnapshot } from '../shared/project-types';

export interface ProjectRepository {
  save(snapshot: ProjectSnapshot): Promise<void>;
}

interface ProjectAutosaveCoordinatorOptions {
  delayMs: number;
  repository: ProjectRepository;
  onError: (error: unknown) => void;
}

export class ProjectAutosaveCoordinator {
  private readonly delayMs: number;
  private readonly repository: ProjectRepository;
  private readonly onError: (error: unknown) => void;
  private pendingSnapshot: ProjectSnapshot | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private writeTask: Promise<void> | null = null;

  constructor(options: ProjectAutosaveCoordinatorOptions) {
    this.delayMs = options.delayMs;
    this.repository = options.repository;
    this.onError = options.onError;
  }

  schedule(snapshot: ProjectSnapshot): void {
    this.pendingSnapshot = structuredClone(snapshot);
    this.clearDebounceTimer();

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.ensureWriteTask().catch(this.onError);
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    this.clearDebounceTimer();
    await this.ensureWriteTask();
  }

  private ensureWriteTask(): Promise<void> {
    if (this.writeTask) {
      return this.writeTask;
    }

    this.writeTask = this.drainPendingSnapshot().finally(() => {
      this.writeTask = null;
    });

    return this.writeTask;
  }

  private async drainPendingSnapshot(): Promise<void> {
    while (this.pendingSnapshot) {
      const snapshotToSave = this.pendingSnapshot;
      this.pendingSnapshot = null;

      try {
        await this.repository.save(snapshotToSave);
      } catch (error) {
        this.restoreFailedSnapshot(snapshotToSave);
        throw error;
      }
    }
  }

  private restoreFailedSnapshot(failedSnapshot: ProjectSnapshot): void {
    if (!this.pendingSnapshot || failedSnapshot.version > this.pendingSnapshot.version) {
      this.pendingSnapshot = failedSnapshot;
    }
  }

  private clearDebounceTimer(): void {
    if (!this.debounceTimer) {
      return;
    }

    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
}
```

저장 실패가 발생하면 실패한 Snapshot을 다시 pending 상태로 돌려놓습니다. 그 사이 더 높은 `version`이 들어왔다면 최신 pending Snapshot을 유지합니다.

이 구현은 실패를 자동으로 무한 재시도하지 않습니다. `onError`에서 저장 실패 상태를 표시하고, 다음 변경이나 명시적인 `flush` 시점에 다시 시도할 수 있습니다. 재시도 횟수와 간격은 장애 정책이므로 Coordinator의 기본 동작과 분리하는 편이 안전합니다.

### [sort2] 7-3. Repository는 임시 파일을 쓴 뒤 원본 경로로 교체한다

```ts
// main/json-project-repository.ts
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ProjectSnapshot } from '../shared/project-types';
import type { ProjectRepository } from './project-autosave-coordinator';

export class JsonProjectRepository implements ProjectRepository {
  constructor(private readonly projectFilePath: string) {}

  async save(snapshot: ProjectSnapshot): Promise<void> {
    const temporaryFilePath = `${this.projectFilePath}.tmp`;
    const serializedSnapshot = JSON.stringify(snapshot, null, 2);

    await mkdir(dirname(this.projectFilePath), { recursive: true });
    await writeFile(temporaryFilePath, serializedSnapshot, 'utf8');
    await rename(temporaryFilePath, this.projectFilePath);
  }
}
```

원본 파일에 직접 쓰다가 중단되는 경로를 줄이기 위해 같은 디렉터리의 임시 파일에 먼저 씁니다. 다만 `rename`의 교체 원자성과 내구성은 운영체제와 파일 시스템 조건의 영향을 받습니다. 외부 프로그램이 파일을 점유하는 Windows 환경, 디스크 공간 부족, 권한 오류도 별도로 테스트해야 합니다. Node.js의 Promise 기반 파일 API와 `rename` 계약은 공식 문서에서 확인할 수 있습니다. ([Node.js File System](https://nodejs.org/api/fs.html))

프로젝트별 Coordinator를 하나만 만든다는 전제도 필요합니다. 같은 프로젝트 파일을 서로 다른 Coordinator가 동시에 쓴다면 각 인스턴스의 Queue는 상대 인스턴스의 쓰기를 제어하지 못합니다.

---

## [sort1] 8. 앱 종료 전에 pending 저장을 flush한다

Debounce Timer가 남아 있는 상태에서 앱이 종료되면 아직 파일 쓰기가 시작되지 않았을 수 있습니다. 종료 절차에서는 Timer를 취소하고 pending Snapshot을 즉시 저장해야 합니다.

```ts
// main/register-project-flush.ts
import { app } from 'electron';

import type { ProjectApplicationService } from './project-application-service';

export function registerProjectFlush(projectApplicationService: ProjectApplicationService): void {
  let isReadyToQuit = false;
  let quitFlushTask: Promise<void> | null = null;

  app.on('before-quit', event => {
    if (isReadyToQuit) {
      return;
    }

    event.preventDefault();

    if (quitFlushTask) {
      return;
    }

    quitFlushTask = projectApplicationService
      .flush()
      .then(() => {
        isReadyToQuit = true;
        app.quit();
      })
      .catch(error => {
        quitFlushTask = null;
        showProjectSaveError(error);
      });
  });
}

function showProjectSaveError(error: unknown): void {
  console.error('프로젝트를 저장하지 못해 종료를 중단했습니다.', error);
}
```

예제는 저장 실패 시 종료를 중단합니다. 실제 제품에서는 다시 시도, 다른 경로에 저장, 저장하지 않고 종료 중 어떤 선택지를 제공할지 정해야 합니다. 이 선택은 구현 세부사항이 아니라 사용자 데이터 보존 정책입니다.

프로세스 강제 종료나 운영체제 장애에서는 `before-quit` 완료를 보장할 수 없습니다. 따라서 `flush`는 정상 종료 경로를 보완하지만, 자동 저장과 임시 파일 복구를 대체하지 않습니다.

---

## [sort1] 9. 저장하지 않는 창 간 이벤트는 분리한다

Editor의 Region 선택을 SRT Script Panel의 Highlight와 Scroll에 전달하는 동작은 창 사이에서 공유되지만 프로젝트 파일에는 저장하지 않습니다.

| 데이터 종류           | 예시                              | 관리 위치                      | 파일 저장 |
| --------------------- | --------------------------------- | ------------------------------ | --------- |
| 저장되는 공유 데이터  | SRT Row, 프로젝트 정보, 편집 결과 | Main의 `ProjectSession`        | 필요      |
| Renderer 내부 상태    | Modal, Filter, Hover              | React State 또는 Zustand Store | 불필요    |
| 일시적인 창 간 이벤트 | Highlight, Scroll, Selection      | 별도 IPC 또는 MessagePort      | 불필요    |

일시적인 UI event를 `ProjectAction`으로 만들면 단순한 Highlight에도 `version` 증가, Snapshot Broadcast, 자동 저장이 실행됩니다. 따라서 프로젝트 문서의 변경과 창 간 UI 명령은 채널과 타입을 분리합니다.

빈도가 낮은 단발성 event는 일반 IPC로 충분합니다. 지속적인 양방향 통신이 필요하면 Electron의 `MessageChannelMain`과 `MessagePortMain`을 별도 검토할 수 있습니다. ([Electron MessagePorts](https://www.electronjs.org/docs/latest/tutorial/message-ports))

---

## [sort1] 10. 기존 구조를 단계적으로 전환한다

한 번에 모든 Renderer Store를 제거하면 회귀 범위가 커집니다. 다음 순서로 변경 경로를 하나씩 옮겼습니다.

1. `ProjectAction`, `ProjectSnapshot`, `version` 계약을 추가합니다.
2. `ProjectSession` 테스트를 작성하고 Main에 현재 프로젝트를 올립니다.
3. 조회·변경·event 구독용 IPC와 Preload API를 연결합니다.
4. SRT Row 수정 한 경로를 `Renderer → ProjectAction → ProjectSession`으로 전환합니다.
5. Renderer Cache가 Main의 확정 Snapshot만 반영하도록 바꿉니다.
6. 자동 저장의 입력을 Renderer Store에서 `ProjectSession` Snapshot으로 바꿉니다.
7. 나머지 프로젝트 변경 경로를 같은 방식으로 이동합니다.
8. Renderer에서 프로젝트 파일을 직접 저장하는 경로를 제거합니다.
9. Highlight와 Scroll 같은 UI event를 프로젝트 변경 채널에서 분리합니다.

전환 중에는 두 저장 경로를 동시에 활성화하지 않는 것이 중요합니다.

```text
금지할 과도기 구조

Renderer Store → Local Project File
       +
ProjectSession → Local Project File
```

두 경로가 같은 파일을 쓰면 어느 쪽이 마지막에 완료될지에 따라 결과가 달라집니다. 이 구조에서는 Main을 추가했어도 오래된 Renderer Snapshot의 저장 경로가 남아 있으므로 원래 문제를 제거했다고 결론 내릴 수 없습니다.

---

## [sort1] 11. 구현 결과를 검증한다

단위 테스트와 두 창을 사용하는 통합 시나리오를 함께 확인합니다.

### [sort2] 11-1. 단위 테스트

- `ProjectSession`은 유효한 Action마다 `version`을 정확히 1 증가시킵니다.
- `getSnapshot` 반환값을 외부에서 바꿔도 Session 내부 상태는 바뀌지 않습니다.
- 존재하지 않는 SRT Row 변경은 실패하고 `version`은 증가하지 않습니다.
- `baseVersion` 불일치 요청은 선택한 충돌 정책에 따라 거절됩니다.
- Renderer Cache는 같거나 낮은 `version`을 무시합니다.
- 자동 저장은 진행 중인 쓰기 뒤에 가장 최신 pending Snapshot만 저장합니다.
- 저장 실패 시 실패한 Snapshot 또는 그보다 높은 최신 Snapshot이 pending으로 남습니다.
- `flush`는 Debounce 대기 중인 Snapshot까지 저장한 뒤 완료됩니다.

### [sort2] 11-2. 멀티 윈도우 통합 시나리오

```text
1. Editor와 SRT Script Panel에서 같은 프로젝트를 연다.
2. SRT Script Panel에서 Row 문장을 수정한다.
3. Editor가 같은 version과 문장을 표시하는지 확인한다.
4. 자동 저장 직후 프로젝트 파일의 version과 문장을 확인한다.
5. 두 창을 닫고 프로젝트를 다시 연다.
6. 저장된 최신 문장이 복구되는지 확인한다.
```

추가로 다음 순서도 재현합니다.

```text
1. version 10 파일 쓰기를 의도적으로 지연한다.
2. version 11, 12, 13 변경을 연속으로 확정한다.
3. version 10 쓰기를 완료한다.
4. 마지막 프로젝트 파일이 version 13인지 확인한다.
```

검증 명령은 프로젝트에 정의된 Script를 사용합니다.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

---

## [sort1] 12. 구현 후 달라진 점

구현 전에는 각 Renderer가 프로젝트 Snapshot을 독립적으로 변경했고, 그중 하나가 자동 저장의 입력이 될 수 있었습니다.

```text
AS IS

Renderer A Store ─┐
Renderer B Store ─┼─ 서로 다른 Snapshot 후보
Renderer C Store ─┘
```

구현 후에는 데이터의 역할이 다음처럼 나뉩니다.

```text
TO BE

Main ProjectSession
└─ 최신 Snapshot과 version 확정

Renderer Query Cache
└─ 확정된 Snapshot을 화면에 표시

Local Project File
└─ 확정된 Snapshot을 앱 재실행 이후까지 보존
```

이 구현으로 확인할 수 있는 변화는 다음과 같습니다.

- 자동 저장이 Renderer별 Store Snapshot을 입력으로 사용하지 않습니다.
- 화면 갱신과 파일 저장이 Main에서 확정한 같은 Snapshot을 사용합니다.
- 늦게 도착한 낮은 `version`이 Renderer Cache를 되돌리지 않습니다.
- 같은 프로젝트 파일의 비동기 쓰기가 동시에 실행되지 않습니다.
- 새 창이 Main의 현재 Snapshot을 다시 조회할 수 있습니다.

이 구조만으로 의미상 충돌 해결, 디스크 장애 복구, 대용량 Snapshot 전송 비용까지 해결되지는 않습니다. `baseVersion`은 충돌 가능성을 감지하고, Queue는 파일 쓰기 순서를 제한할 뿐입니다. 각 문제에는 별도의 정책과 검증이 필요합니다.

> 공유 데이터 구현의 핵심은 Store를 한 곳에 만드는 데서 끝나지 않았습니다. 변경을 확정하는 경로, 화면에 전달하는 경로, 파일에 보존하는 경로가 같은 Snapshot을 따르도록 만드는 일이었습니다.
