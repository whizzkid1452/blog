# Main Process에 SSOT를 둔 Electron 멀티 윈도우 편집기의 프로젝트 상태 설계

## 핵심 주장

> 여러 Renderer가 공유하고 프로젝트 파일에 저장할 `ProjectDocument`의 최종 변경 권한을 Main Process의 `ProjectSession`에 둔다.

이 글에서 Single Source of Truth(SSOT)는 값이 한 벌만 존재한다는 뜻이 아니다. Main의 `ProjectDocument`만 최종 상태를 확정하고, 각 Renderer의 `ProjectSnapshot`은 화면 표시를 위한 읽기 전용 cache로 사용한다는 뜻이다.

## 문서에서 구분할 내용

| 구분                    | 내용                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 확인 사실               | 여러 Renderer에서 편집값과 저장값의 불일치가 관찰되었고, 기존 구조에는 프로젝트 상태의 최종 변경 권한과 공통 version 규칙이 없었다. |
| 공식 문서로 확인한 사실 | 각 `BrowserWindow`는 별도 Renderer Process에서 실행되며, Main과 Renderer는 IPC message로 통신한다.                                  |
| 설계 판단               | 저장 가능한 프로젝트 상태, version, Undo/Redo History의 최종 변경 권한을 Main에 둔다.                                               |
| 미정 사항               | 자동저장 허용 손실 시간, 같은 항목의 동시 수정 규칙, History 영속화 여부, 성능 허용 기준은 제품 정책과 측정값이 필요하다.           |

## 국문 초록

- 멀티 윈도우 편집기에서 발생한 편집값과 저장값의 불일치를 설명한다.
- 상태 불일치의 직접 원인과 이를 허용한 구조적 조건을 구분한다.
- Main Process에 `ProjectDocument`의 최종 변경 권한을 두는 구조를 제안한다.
- Renderer cache, Undo/Redo, 자동저장을 같은 project version으로 연결하는 방법을 설명한다.
- 실패 시나리오와 성능 측정으로 설계의 적용 가능성을 검증한다.
- 측정 전에는 이 구조를 최적이라고 단정하지 않는다.

## 1. 서론

### 1.1. 연구 배경

- SRT, Timeline, media asset을 편집하고 로컬 프로젝트 파일로 저장하는 Electron 편집기를 설명한다.
- Editor, Studio, Admin, 분리 가능한 SRT Script Panel이 같은 프로젝트 상태를 사용하는 환경을 설명한다.

### 1.2. 문제 제기

- Renderer별 Store가 같은 프로젝트 값을 각각 변경한 기존 구조를 설명한다.
- 화면에서 편집한 값과 프로젝트 파일에 저장한 값이 달라진 증상을 제시한다.
- 기능별로 분리된 Undo/Redo가 화면, 실행 객체, 저장 결과를 서로 다른 시점으로 되돌릴 수 있었던 문제를 제시한다.

### 1.3. 연구 질문

1. 여러 Renderer가 공유하는 `ProjectDocument`의 최종 상태를 어디에서 확정할 것인가?
2. Main이 확정한 상태를 각 Renderer가 어떻게 같은 version으로 표시할 것인가?
3. 기능별 Undo/Redo와 자동저장을 어떻게 같은 `ProjectDocument` 흐름으로 통합할 것인가?
4. 이 구조의 비용과 다시 검토해야 할 조건은 무엇인가?

### 1.4. 핵심 주장

- Main의 `ProjectSession`이 `ProjectDocument`, project version, Undo/Redo History를 확정한다.
- Renderer는 읽기 전용 `ProjectSnapshot`과 UI·runtime state만 가진다.
- 자동저장은 Main이 확정한 snapshot만 저장한다.

### 1.5. 연구 범위

- 포함: 상태 소유 위치, 변경 요청과 확정 결과, Renderer cache, Undo/Redo, 자동저장, 복구, 검증 기준
- 제외: PR 분리, 브랜치와 커밋 순서, 파일별 마이그레이션, 클래스의 전체 method 목록, 측정하지 않은 성능 효과

## 2. 편집기 환경과 상태 불일치

### 2.1. 프로젝트 편집 흐름

- SRT row 수정, TTS 생성, Timeline 편집, 프로젝트 저장과 다시 열기 흐름을 설명한다.
- 프로젝트 파일에 들어갈 값과 Renderer에서만 사용하는 임시 값을 구분한다.

### 2.2. 창과 탭의 접근 규칙

- Editor와 Studio는 동시에 접근할 수 없다는 제품 규칙을 설명한다.
- SRT Script Panel은 별도 창으로 분리할 수 있고 Editor 또는 Admin과 함께 열릴 수 있음을 설명한다.
- Editor와 Studio의 상호 배제만으로 멀티 Renderer 상태 문제가 사라지지 않는 이유를 설명한다.

### 2.3. 공유하는 프로젝트 상태

- 프로젝트 정보, SRT row, Timeline item, asset 참조, 편집 설정을 `ProjectDocument`로 정의한다.
- selection, modal, drag preview, playhead, `AudioBuffer`, AudioEngine을 Renderer UI·runtime state로 분류한다.

### 2.4. 기존 상태 구조

- Editor Store, SRT Store, Admin Store가 같은 프로젝트의 일부 값을 각각 보관한 구조를 설명한다.
- Renderer의 `SaveController`가 여러 Store를 읽어 프로젝트 문서를 다시 조립한 흐름을 설명한다.
- SRT, Timeline, Audio 기능별 History가 서로 다른 state와 실행 객체를 참조한 구조를 설명한다.

### 2.5. 증상, 직접 원인, 구조적 조건

- 증상: 편집한 값과 저장한 값이 달랐다.
- 직접 원인: 저장 흐름이 사용자가 마지막으로 수정한 Store와 다른 값을 읽을 수 있었다.
- 구조적 조건: 같은 프로젝트 값을 여러 Store가 변경했지만 최종 변경 권한과 공통 version 규칙이 없었다.
- Store가 여러 개라는 사실만으로 문제가 발생했다고 일반화하지 않는다.

## 3. 기술적 배경과 설계 요구사항

### 3.1. Electron Process Model

- Electron 앱에는 하나의 Main Process가 있고, 각 `BrowserWindow`는 별도 Renderer Process에서 웹 페이지를 실행한다. [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- 이 사실은 Renderer별 JavaScript memory의 자동 공유를 제공하지 않는다는 설계 제약으로 사용한다.

### 3.2. Electron IPC

- Renderer의 요청과 Main의 응답에는 `ipcRenderer.invoke`와 `ipcMain.handle`을 사용할 수 있다.
- Main은 `webContents.send`로 Renderer에 event를 보낼 수 있다.
- Renderer 간 직접 `ipcMain`·`ipcRenderer` 통신은 지원되지 않으며, Main을 중계자로 사용하거나 MessagePort를 전달해야 한다. [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)

### 3.3. React 외부 Store 구독

- `useSyncExternalStore`는 외부 Store의 snapshot을 읽고 변경을 구독하는 React Hook이다.
- 이 Hook은 snapshot을 저장하는 공간을 만들지 않는다. [React `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)

### 3.4. TanStack Query Cache

- Main이 반환한 확정 결과는 `queryClient.setQueryData`로 Renderer cache에 반영할 수 있다. [TanStack Query: Updates from Mutation Responses](https://tanstack.com/query/v5/docs/framework/react/guides/updates-from-mutation-responses)
- TanStack Query는 Main과 Renderer의 IPC transport를 대체하지 않는다.
- cache 자체가 version 중복 제거와 event 누락 복구를 자동으로 보장한다고 가정하지 않는다.

### 3.5. 설계 요구사항

1. 프로젝트 상태를 최종 확정하는 위치는 하나여야 한다.
2. 모든 저장 가능한 변경은 project version을 증가시켜야 한다.
3. 열린 Renderer는 Main이 확정한 같은 version을 따라야 한다.
4. Undo/Redo와 자동저장은 같은 `ProjectDocument`를 기준으로 실행되어야 한다.
5. 저장하지 않는 고빈도 UI state는 프로젝트 변경 경로와 분리해야 한다.
6. event 중복, 순서 역전, 누락 뒤에도 최신 snapshot으로 복구할 수 있어야 한다.

## 4. `ProjectDocument`의 최종 변경 위치 비교

### 4.1. Renderer별 Store 유지

- 장점: 기존 코드 변경 범위가 작다.
- 비용: 최종값 선택, 창 종료, 저장 전 문서 조립, History 통합 규칙이 계속 필요하다.

### 4.2. 특정 Renderer를 기준 Store로 지정

- 장점: 하나의 상위 React Store와 비슷한 구조를 유지할 수 있다.
- 비용: 해당 창의 수명주기에 프로젝트 상태가 묶이며 Admin과 분리 창의 접근 흐름이 복잡해진다.

### 4.3. Main `ProjectSession`에서 확정

- 장점: 창의 생성·종료와 독립된 project lifetime을 유지하고 로컬 파일 저장과 같은 snapshot을 사용할 수 있다.
- 비용: 모든 저장 가능한 변경이 IPC 경계를 지나며 version과 event 복구 규칙이 필요하다.

### 4.4. 비교 기준

- 창의 수명주기와 프로젝트 상태를 분리할 수 있는가?
- 프로젝트 파일과 Undo/Redo가 같은 snapshot을 사용하는가?
- 변경 권한과 충돌 규칙을 한 곳에서 적용할 수 있는가?
- IPC payload와 응답 시간이 편집 경험의 허용 범위에 있는가?

### 4.5. 선택 결과

- 이 편집기의 조건에서는 Main `ProjectSession`을 선택한다.
- 이 결정은 모든 Electron 앱에 적용되는 일반 결론이 아니라 현재 제품 조건에 대한 설계 판단이다.

## 5. Main SSOT와 Renderer 상태 경계

### 5.1. Main의 `ProjectDocument`

- 프로젝트 정보, SRT, Timeline, asset 참조, 편집 설정을 보관한다.
- project version과 Undo/Redo History를 함께 관리한다.
- Main만 저장 가능한 프로젝트 상태의 최종 변경 권한을 가진다.

### 5.2. Renderer의 `ProjectSnapshot`

- TanStack Query Cache에 Main의 확정 snapshot을 읽기 전용으로 보관한다.
- component는 필요한 부분을 읽어 화면을 갱신한다.
- 사용자 입력은 cache를 최종값으로 확정하지 않고 Main에 `ProjectAction`으로 보낸다.

### 5.3. Renderer의 UI·runtime state

- Zustand 또는 React state에는 selection, modal, drag preview, playhead 같은 Renderer local state를 둔다.
- AudioEngine, `AudioBuffer`, Timeline Region 같은 실행 객체는 Renderer에 둔다.
- Renderer의 Zustand는 화면과 실행 상태를 위한 Store이며 `ProjectDocument`의 두 번째 SSOT가 아니다.

### 5.4. `ProjectSession` private field와 Vanilla Zustand 비교

- `ProjectSession`의 private field와 method만으로 현재 문서 읽기, 변경, version, History를 캡슐화할 수 있는지 먼저 검토한다.
- Vanilla Zustand의 `createStore`는 React 없이 `getState`, `setState`, `subscribe`를 제공하지만, 현재 요구사항에서는 `ProjectSession` API와 역할이 겹친다. [Zustand `createStore`](https://zustand.docs.pmnd.rs/reference/apis/create-store)
- Main 내부의 selector 구독, middleware, 상태 추적 요구가 실제로 생길 때 Vanilla Zustand를 다시 비교한다.

### 5.5. Main 내부 책임 분리

- `ProjectSession`: action 검증, document update, version, History
- project event publisher: 열린 Renderer 구독과 확정 결과 발행
- autosave coordinator: debounce, pending snapshot, `diskSavedVersion`, `flush`
- project repository: JSON 변환, temp file, backup, project file 교체
- IPC handler: preload에 노출할 요청 API와 입력 경계

### 5.6. 변경 요청 순서 처리

- `dispatch`, `undo`, `redo`가 짧은 동기 state update라면 별도 전역 비동기 queue를 기본으로 두지 않는다.
- 파일 쓰기에는 프로젝트별 queued sequential execution을 적용한다.
- TTS 생성처럼 늦게 끝나는 비동기 결과는 대상 project, item, 시작 version을 다시 확인한 뒤 적용한다.

### 5.7. 전체 구조도

- Renderer, IPC, Main `ProjectSession`, autosave, 로컬 project file의 경계를 한 그림으로 제시한다.
- 변경 요청, 확정 결과, cache update, 자동저장 방향을 화살표로 구분한다.
- 클래스의 private method보다 상태 위치와 변경 권한을 중심으로 표현한다.

## 6. Main과 Renderer의 상태 동기화

### 6.1. 변경 요청 모델

- Renderer는 전체 snapshot이 아니라 `actionId`, `baseVersion`, 변경 의도를 포함한 `ProjectAction`을 보낸다.
- action type은 변경 대상을 확인할 수 있는 TypeScript union으로 정의한다.

### 6.2. Main의 변경 확정

1. 요청의 project와 입력값을 검증한다.
2. 현재 version과 `baseVersion`을 비교한다.
3. `ProjectDocument`에 변경을 적용한다.
4. History를 갱신한다.
5. project version을 증가시킨다.
6. `ProjectUpdateResult`를 만든다.
7. 자동저장을 요청한다.

### 6.3. 요청 응답과 event 발행

- Main은 요청 Renderer에 확정된 `ProjectUpdateResult`를 직접 반환할 수 있다.
- Main은 열린 Renderer에도 같은 결과를 event로 발행한다.
- 요청 응답과 event가 모두 도착할 수 있으므로 `version`과 `actionId`로 중복 적용을 막는다.

### 6.4. Renderer cache 갱신

- mutation 응답과 Main event는 같은 cache update 함수를 사용한다.
- `queryClient.setQueryData`는 immutable update로 실행한다.
- component는 cache 변경을 구독해 필요한 부분을 다시 렌더한다.

### 6.5. version 중복과 누락 복구

- 받은 version이 현재 version 이하면 이미 적용한 결과로 보고 무시한다.
- 받은 version이 현재 version보다 1 크면 patch를 적용한다.
- 받은 version이 2 이상 크면 중간 event 누락으로 보고 Main의 전체 snapshot을 다시 읽는다.

### 6.6. 최초 구독과 새 창 초기화

- listener를 먼저 등록하고 초기 event를 임시 보관한 뒤 Main snapshot을 받는다.
- snapshot보다 큰 buffered event만 순서대로 적용한다.
- 새 창은 다른 Renderer Store가 아니라 Main의 최신 snapshot으로 시작한다.

### 6.7. 탭 전환과 화면 접근 규칙

- Admin 탭 진입 시 debounce 중일 수 있는 디스크 파일을 다시 읽지 않는다.
- Renderer cache version을 확인하고 필요하면 Main snapshot을 다시 읽는다.
- Editor와 Studio의 상호 배제는 Main의 workspace mode 확인으로 처리한다.

### 6.8. 일반 IPC와 MessagePort의 경계

- 저장 가능한 action과 region click 같은 낮은 빈도 event에는 일반 IPC를 우선한다.
- playhead와 drag preview 같은 고빈도 임시 state는 먼저 Renderer local state로 처리한다.
- Renderer 간 지속적인 message stream이 필요하고 실제 병목이 확인될 때 MessagePort를 검토한다. `MessageChannelMain`은 연결된 `MessagePortMain` 두 개를 만든다. [Electron `MessageChannelMain`](https://www.electronjs.org/docs/latest/api/message-channel-main)

## 7. Undo/Redo History 통합

### 7.1. 기능별 History의 한계

- 한 사용자 동작이 SRT, Timeline, Audio 상태를 함께 바꿀 때 되돌리는 순서가 불명확했던 문제를 설명한다.
- Renderer 실행 객체를 직접 참조한 action을 Main에 그대로 옮길 수 없는 이유를 설명한다.

### 7.2. 문서 상태와 실행 상태 분리

- Main은 직렬화 가능한 `ProjectDocument` 변경만 복원한다.
- Renderer는 Main의 확정 결과를 AudioEngine과 Timeline runtime에 반영한다.
- selection과 focus 같은 UI state의 Undo 포함 여부는 별도 UI 정책으로 둔다.

### 7.3. History entry

- Redo용 forward patch와 Undo용 inverse patch를 한 entry로 저장한다.
- 하나의 drag, split, 복수 item 수정은 하나의 action group으로 묶는다.
- 새 일반 action이 들어오면 Redo stack을 비운다.

### 7.4. Undo와 Redo의 확정 흐름

- Undo와 Redo도 Main의 새 document update로 처리한다.
- project version을 증가시키고 모든 Renderer에 결과를 발행한다.
- 변경된 snapshot을 자동저장 대상으로 등록한다.

### 7.5. Renderer runtime 복구

- 평상시에는 patch에 포함된 실행 객체만 증분 갱신한다.
- runtime version 불일치나 증분 반영 실패 시 전체 snapshot으로 AudioEngine을 다시 만든다.

### 7.6. History와 asset lifetime

- 현재 문서나 Undo/Redo History가 참조하는 asset은 삭제하지 않는다.
- History 길이와 asset 정리 시점은 함께 결정한다.
- 앱 재시작 뒤 History를 복원할지는 미정 사항으로 남긴다.

## 8. 자동저장과 복구

### 8.1. Renderer `SaveController`의 역할

- 저장 버튼, Save As, 저장 상태 표시, 오류 안내, 재시도 UI를 담당한다.
- 여러 Renderer Store를 읽어 `ProjectDocument`를 조립하지 않는다.
- 수동 저장과 종료 전 `flush`를 Main에 요청한다.

### 8.2. Main autosave coordinator의 역할

- `ProjectSession`의 확정 update를 자동저장 입력으로 받는다.
- debounce timer, 최신 pending snapshot, 파일 쓰기 상태를 관리한다.
- 자동저장과 수동 저장의 중복 실행을 조정한다.

### 8.3. 저장 완료 지점 구분

- Main memory update 완료
- project file 교체 완료
- 저장 장치 sync 완료
- `실시간 저장`이라는 표현 대신 제품이 요구하는 완료 지점을 명시한다.

### 8.4. Debounce와 최신 snapshot 유지

- 연속 update 동안 중복 파일 쓰기를 줄이기 위해 debounce한다.
- 저장 중 새 version이 들어오면 아직 저장하지 않은 최신 snapshot만 다음 저장 대상으로 유지한다.

### 8.5. 파일 쓰기의 queued sequential execution

- 같은 project file에는 한 번에 하나의 비동기 쓰기만 실행한다.
- 앞선 쓰기가 끝난 뒤 최신 pending snapshot을 저장한다.
- 이 queue는 Main의 모든 document action이 아니라 디스크 쓰기에만 적용한다.

### 8.6. `diskSavedVersion`과 저장 UI

- Main memory의 current version과 파일 교체가 완료된 `diskSavedVersion`을 분리한다.
- 두 version이 다르면 dirty 또는 saving 상태를 유지한다.
- 저장 실패 시 dirty 상태와 재시도 가능 상태를 유지한다.

### 8.7. 안전한 파일 교체와 복구

- temp file 쓰기, 기존 정상 파일 보존, project file 교체 순서를 사용한다.
- 정상 종료 시 pending snapshot을 `flush`한다.
- 비정상 종료 시 project file, backup, recovery 후보의 version을 비교한다.
- 운영체제와 파일 시스템에 관계없이 완전한 원자성을 보장한다고 단정하지 않는다.

### 8.8. 충돌과 늦은 비동기 결과

- 같은 SRT row를 두 창이 수정할 때 `baseVersion` 불일치를 거절할지 마지막 입력을 적용할지 제품 정책으로 결정한다.
- TTS와 waveform 분석 결과는 project, item, 시작 version을 다시 확인한 뒤 적용한다.

## 9. 검증 방법

### 9.1. Renderer 상태 일치

- Editor, SRT Panel, Admin에서 같은 SRT row가 동일 version으로 표시되는지 확인한다.
- 새 Renderer가 Main의 최신 snapshot으로 시작하는지 확인한다.

### 9.2. 중복과 event 누락 복구

- 요청 응답과 같은 event가 중복 도착해도 한 번만 적용되는지 확인한다.
- event 순서가 바뀌거나 중간 version이 누락되면 전체 snapshot으로 복구되는지 확인한다.

### 9.3. Undo/Redo 일치

- 어느 Renderer에서 Undo/Redo를 요청해도 모든 열린 Renderer가 같은 결과를 받는지 확인한다.
- 한 번의 drag와 split이 하나의 History entry가 되는지 확인한다.
- History가 참조하는 asset이 너무 일찍 삭제되지 않는지 확인한다.

### 9.4. 자동저장과 장애 복구

- 저장 중 새 update가 들어와도 마지막 snapshot이 파일에 남는지 확인한다.
- 파일 쓰기 실패 뒤 dirty 상태와 재시도가 유지되는지 확인한다.
- 정상 종료와 Main 비정상 종료를 나누어 recovery 동작을 확인한다.

### 9.5. 성능 측정

- 사용자 입력부터 Renderer 화면 반영까지의 시간
- Main event loop 지연
- patch와 전체 snapshot의 IPC payload 크기
- 대표 프로젝트의 파일 저장 시간
- TanStack Query cache update 뒤 component 리렌더 범위
- 측정값이 없으면 성능 개선을 결과로 쓰지 않는다.

## 10. 논의

### 10.1. 줄이려는 위험

- 편집 state와 저장 state가 다른 값을 가리키는 위험
- 창마다 Undo/Redo 결과가 달라지는 위험
- 새 창이 오래된 project version으로 시작하는 위험
- Renderer 종료와 함께 자동저장 흐름이 사라지는 위험

### 10.2. 새로 생기는 비용

- 모든 저장 가능한 변경이 IPC 경계를 지난다.
- version, action 중복, event 누락, 초기 구독을 처리해야 한다.
- ProjectSnapshot cache와 UI·runtime state의 경계를 유지해야 한다.
- document update를 AudioEngine에 반영하는 runtime sync가 필요하다.

### 10.3. 적용 조건

- 여러 Renderer가 같은 로컬 프로젝트를 편집한다.
- 프로젝트 파일 저장이 Main을 거친다.
- 프로젝트 상태를 직렬화 가능한 값으로 표현할 수 있다.
- Main의 state update를 짧고 동기적으로 유지할 수 있다.
- CPU 사용이 큰 작업을 Main의 state update 경로와 분리할 수 있다.

### 10.4. 다시 검토할 조건

- IPC 응답 시간이 입력 경험의 허용 범위를 넘는다.
- snapshot 복구나 runtime 재구성 비용이 크다.
- patch 종류가 늘어 update 규칙을 유지하기 어렵다.
- Main 내부 selector 구독이 복잡해져 private field만으로 추적하기 어렵다.
- 하나의 Renderer만 사용하거나 외부 서버가 이미 최종 상태를 확정한다.

### 10.5. 아직 결정하지 못한 사항

1. 자동저장이 허용하는 최대 데이터 손실 시간
2. action 응답 전에 disk write 또는 별도 recovery log가 필요한지 여부
3. 같은 항목의 동시 수정 충돌 규칙
4. 앱 재시작 뒤 Undo/Redo History 복원 여부
5. History가 asset을 보존할 기간
6. 입력 응답 시간과 Main event loop 지연의 허용 기준

## 11. 결론

### 11.1. 연구 질문에 대한 답

- `ProjectDocument`의 최종 변경 권한은 Main `ProjectSession`에 둔다.
- Renderer는 TanStack Query Cache의 읽기 전용 `ProjectSnapshot`으로 화면을 갱신한다.
- Undo/Redo와 자동저장은 Main의 같은 document version을 기준으로 실행한다.

### 11.2. 핵심 설계 원칙

> SSOT의 핵심은 복사본을 없애는 것이 아니라 최종 변경 권한을 한 곳에 두는 것이다.

### 11.3. 결론의 한계

- 현재 결론은 제품 구조와 공식 문서에 근거한 설계 판단이다.
- 상태 일치, 복구, 응답 시간을 실제로 검증한 뒤 적용 가능성을 최종 평가해야 한다.

## 참고문헌

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron MessageChannelMain](https://www.electronjs.org/docs/latest/api/message-channel-main)
- [React `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
- [TanStack Query: Updates from Mutation Responses](https://tanstack.com/query/v5/docs/framework/react/guides/updates-from-mutation-responses)
- [Zustand `createStore`](https://zustand.docs.pmnd.rs/reference/apis/create-store)

## 부록

### A. 상태 위치와 변경 권한 표

- Main `ProjectDocument`
- Renderer `ProjectSnapshot`
- Renderer UI·runtime state
- disk `project.json`

### B. 상태 동기화 시나리오

- 정상 update
- 중복 응답과 event
- version gap
- 새 창 초기화
- 늦은 비동기 결과

### C. 자동저장 실패 시나리오

- 저장 중 새 update
- 파일 쓰기 실패
- 정상 종료 전 `flush`
- Main 비정상 종료와 recovery
