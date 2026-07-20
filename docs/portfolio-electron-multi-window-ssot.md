# Electron 멀티 윈도우 프로젝트 상태 일관성 구조 개편

## 프로젝트 목표

SRT 자막과 음성을 함께 편집하는 Electron 멀티 윈도우 애플리케이션에서 화면에 표시되는 프로젝트 데이터와
로컬 프로젝트 파일에 자동 저장되는 데이터가 같은 확정 상태를 사용하도록 변경했습니다.

## 문제

Editor, Admin, SRT Script Panel이 동일한 프로젝트 데이터를 각 Renderer의 독립적인 Store에 보관했습니다.
SRT Script Panel에서 자막을 수정하면 해당 Renderer에만 최신 값이 반영됐고, 다른 Renderer에는 수정 전
Snapshot이 남았습니다.

이 상태에서 오래된 Snapshot을 가진 Renderer가 자동 저장을 요청하면 파일 쓰기 함수는 전달받은 값을 정상적으로
기록했습니다. 그 결과 사용자가 수정한 SRT 자막이 수정 전 내용으로 덮어써졌습니다.

```text
SRT Script Panel Renderer
└─ 최신 자막

Editor Renderer
└─ 수정 전 자막
      ↓ 자동 저장
Local Project File
└─ 수정 전 자막
```

직접적인 문제는 파일 쓰기 실패가 아니라 **오래된 Renderer Snapshot이 자동 저장의 입력이 될 수 있었던 변경
경로**였습니다.

## 구현

### 1. Main Process에서 프로젝트 변경을 최종 확정

저장되는 프로젝트 데이터의 변경 권한을 Main Process로 이동했습니다. Renderer는 프로젝트 상태를 직접
확정하지 않고 사용자의 변경 의도를 타입이 정의된 요청으로 전달합니다.

```text
Renderer
   ↓ Project Action
Main Process
   ├─ 요청 검증
   ├─ Project Snapshot 확정
   ├─ Renderer에 확정 결과 발행
   └─ 자동 저장에 동일한 Snapshot 전달
```

Main Process의 프로젝트 상태는 외부에서 직접 수정할 수 없도록 감추고 조회와 변경 API만 공개했습니다. 상태
변경, Renderer 알림, 저장 시점 결정, 파일 변환을 다음 책임으로 분리했습니다.

| 책임           | 역할                                                     |
| -------------- | -------------------------------------------------------- |
| 프로젝트 상태  | 변경 검증, Snapshot과 version 확정                       |
| 변경 결과 발행 | 열린 Renderer에 확정 결과 전달                           |
| 자동 저장 조정 | Debouncing, pending Snapshot 교체, 파일 쓰기 순서, flush |
| 파일 저장      | JSON 변환과 로컬 프로젝트 파일 교체                      |
| IPC 경계       | Preload에 노출할 API와 입력 검증                         |

### 2. 타입 기반 변경 요청과 version 적용

Renderer가 전체 프로젝트 객체를 덮어쓰지 않도록 변경 종류와 payload를 담은 Action을 Main으로 전달했습니다.
Main이 변경을 확정할 때마다 단조 증가하는 `version`을 Snapshot에 기록했습니다.

아래 코드는 메커니즘을 설명하기 위해 프로젝트 내부 이름을 일반화한 예시입니다.

```ts
type SubtitleRow = {
  id: string;
  text: string;
};

type ProjectSnapshot = {
  version: number;
  rows: SubtitleRow[];
};

type ProjectAction = {
  actionId: string;
  baseVersion: number;
  type: 'subtitle-text-updated';
  payload: {
    rowId: string;
    text: string;
  };
};
```

`baseVersion`으로 Renderer가 어떤 Snapshot을 기준으로 요청을 만들었는지 전달했습니다. Main의 현재 version과
다른 요청을 어떻게 처리할지는 변경 종류에 따른 충돌 정책으로 분리했습니다. version은 확정 순서를 나타내며,
그 자체가 충돌 해결 규칙은 아닙니다.

```ts
class ProjectStateSession {
  private currentSnapshot: ProjectSnapshot;

  constructor(initialSnapshot: ProjectSnapshot) {
    this.currentSnapshot = structuredClone(initialSnapshot);
  }

  getSnapshot(): ProjectSnapshot {
    return structuredClone(this.currentSnapshot);
  }

  dispatch(action: ProjectAction): ProjectSnapshot {
    const nextRows = this.currentSnapshot.rows.map(row => {
      if (row.id !== action.payload.rowId) {
        return row;
      }

      return { ...row, text: action.payload.text };
    });

    this.currentSnapshot = {
      version: this.currentSnapshot.version + 1,
      rows: nextRows,
    };

    return this.getSnapshot();
  }
}
```

### 3. Renderer Cache를 화면 표시용 복사본으로 제한

Main이 확정한 Snapshot을 열린 Renderer에 전달하고 TanStack Query Cache에 반영했습니다. Renderer는 전달받은
version이 현재 Cache보다 클 때만 값을 교체하도록 제한했습니다.

```ts
function applyConfirmedSnapshot(incomingSnapshot: ProjectSnapshot): void {
  queryClient.setQueryData<ProjectSnapshot>(['project'], currentSnapshot => {
    if (currentSnapshot && incomingSnapshot.version <= currentSnapshot.version) {
      return currentSnapshot;
    }

    return incomingSnapshot;
  });
}
```

Renderer Cache는 화면 렌더링을 위한 로컬 복사본입니다. 사용자의 입력은 Cache 값을 프로젝트의 최종 상태로
직접 확정하지 않고 Main에 다시 변경 요청으로 전달합니다.

### 4. 자동 저장 입력을 Main Snapshot으로 제한

자동 저장 API가 Renderer의 프로젝트 객체를 받지 않도록 변경했습니다. 사용자의 변경은 Main의 메모리
Snapshot에서 먼저 확정하고, 자동 저장은 Main이 제공한 Snapshot만 사용합니다.

```text
기존

Renderer Store
    ↓
자동 저장

변경 후

Renderer 변경 요청
    ↓
Main Snapshot 확정
    ↓
자동 저장
```

파일 저장에는 세 가지 제어를 각각 적용했습니다.

1. **Debouncing:** 입력이 이어지는 동안 저장 시작 시점을 뒤로 미룹니다.
2. **Pending Snapshot 교체:** 대기 중인 여러 Snapshot을 병합하지 않고 다음에 저장할 참조를 최신 Snapshot으로
   교체합니다.
3. **프로젝트별 순차 파일 쓰기:** 같은 프로젝트 파일에 대한 비동기 쓰기는 한 번에 하나만 실행하고, 앞선
   쓰기가 완료된 뒤 다음 쓰기를 시작합니다.

예를 들어 version 10을 저장하는 동안 version 11, 12, 13이 확정되면 version 11과 12를 각각 저장하지
않습니다. version 10의 파일 쓰기가 완료된 뒤 아직 저장되지 않은 최신 version 13을 기록합니다.

이 제어는 모든 프로젝트 변경을 순차 실행한다는 뜻이 아닙니다. 메모리 Snapshot은 각 변경 요청을 처리할 때
확정하고, 동일한 프로젝트 파일을 대상으로 한 비동기 쓰기만 대기열에서 하나씩 실행합니다.

### 5. 저장 데이터와 UI 상태의 경계 분리

여러 창에서 사용한다는 이유만으로 모든 상태를 Main에 저장하지 않았습니다. 보존 기간과 파일 저장 필요 여부에
따라 상태를 구분했습니다.

| 상태                              | 관리 위치                | 전달 방법               | 파일 저장          |
| --------------------------------- | ------------------------ | ----------------------- | ------------------ |
| SRT Row, 프로젝트 정보, 편집 결과 | Main Process             | IPC Snapshot 또는 Patch | 필요               |
| 화면 표시용 프로젝트 복사본       | Renderer Query Cache     | Main 확정 결과 구독     | 직접 저장하지 않음 |
| Modal, Filter, Hover              | React State 또는 Zustand | Renderer 내부           | 불필요             |
| Highlight, Scroll, Selection      | Renderer                 | IPC 또는 MessagePort    | 불필요             |

이를 통해 Row Highlight나 Scroll 같은 일시적인 상호작용이 프로젝트 Snapshot 변경과 자동 저장을 발생시키지
않도록 분리했습니다.

## 선택 근거

Main Process는 특정 Renderer의 생명주기에 종속되지 않고, 프로젝트 파일 저장과 창 간 메시지 전달 경로가
이미 모이는 위치였습니다. 따라서 다음 제품 조건을 만족하는 프로젝트 데이터만 Main에서 최종 확정했습니다.

- 여러 Renderer가 같은 값을 사용합니다.
- 특정 창이 닫혀도 데이터가 유지되어야 합니다.
- 프로젝트 파일에 저장되어야 합니다.
- 화면 표시와 자동 저장이 같은 확정값을 사용해야 합니다.

로컬 프로젝트 파일은 애플리케이션 종료 이후의 보존과 재실행 시 복구에 사용했습니다. React State, Zustand,
TanStack Query Cache는 각 Renderer의 화면 상태와 확정된 프로젝트 데이터 표시를 담당하도록 역할을 제한했습니다.

## 결과

Renderer의 오래된 프로젝트 복사본이 자동 저장의 직접 입력이 되는 경로를 제거했습니다. Main Process가
확정한 동일한 Snapshot을 Renderer 갱신과 로컬 파일 저장에 사용하도록 변경해, 기존에 확인된 오래된 Snapshot
덮어쓰기 경로를 구조적으로 차단했습니다.

현재 자료에는 변경 전후 오류 발생률, IPC 응답 시간, 저장 복구 성공률을 비교한 측정값이 없습니다. 따라서
정량적인 성능 향상이나 데이터 유실의 완전한 제거는 결과로 주장하지 않습니다.

## 포트폴리오용 요약

- **Electron 멀티 윈도우 프로젝트 상태 일관성 구조 개편**
  - 문제: 각 Renderer가 같은 프로젝트의 독립적인 Store를 소유해 한 화면의 최신 SRT 수정값이 다른 화면의
    오래된 Snapshot을 사용한 자동 저장으로 덮어써졌습니다.
  - 해결: Main Process에서 프로젝트 변경을 최종 확정하고, Renderer의 타입 기반 변경 요청, 단조 증가 version,
    화면용 Query Cache, Main Snapshot 기반 자동 저장 흐름을 구현했습니다. 자동 저장에는 Debouncing, 최신
    pending Snapshot 교체, 프로젝트별 순차 파일 쓰기를 적용했습니다.
  - 선택 근거: Main Process는 특정 창의 생명주기에 종속되지 않으며 기존 파일 저장과 Renderer 메시지 전달
    경로가 모이는 위치였기 때문에 실행 중 프로젝트 상태를 확정하기에 적합했습니다.
  - 결과: Renderer의 오래된 복사본이 직접 저장 입력이 되는 경로를 제거하고, 화면과 파일 저장이 Main에서
    확정한 동일한 Snapshot을 사용하도록 변경했습니다.

## 추가하면 좋은 검증 자료

포트폴리오를 공개하기 전에 다음 근거를 실제 측정 결과로 보완하면 구현 효과를 더 정확하게 설명할 수 있습니다.

- 서로 다른 두 Renderer에서 연속으로 같은 SRT Row를 변경하는 재현 테스트
- 오래된 version의 IPC 응답과 Broadcast를 무시하는 단위 테스트
- 여러 Snapshot이 대기할 때 마지막 Snapshot만 저장하는 자동 저장 테스트
- 프로젝트 전환과 애플리케이션 종료 시 flush 테스트
- IPC 요청부터 Renderer Cache 반영까지의 응답 시간
- 비정상 종료 후 마지막으로 복구되는 version 확인
