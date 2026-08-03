---
title: 'Electron 앱에서는 어떤 오류 정보까지 수집해야 할까?'
description: '배포 환경의 Electron 오류를 Sentry로 수집하면서 사용자 작성 내용과 로컬 경로를 제외하도록 허용 목록 기반 이벤트 구조를 설계한 과정을 정리합니다.'
date: '2026-08-03'
tags: ['electron', 'sentry', 'error-monitoring', 'react', 'tanstack-query', 'privacy']
draft: false
visibility: public
---

배포 환경에서 확인하기 어려웠던 Electron 오류를 Sentry로 수집하고, 사용자 작성 내용과 로컬 경로를 제외한 정보만 전송하도록 허용 목록 기반 이벤트 구조를 설계한 과정을 정리합니다.

이 글은 Sentry SDK를 설치하는 방법보다 **오류를 진단하는 데 필요한 정보와 전송하지 않을 정보의 경계를 정한 과정**에 집중합니다.

아래 코드는 `@sentry/electron` 7.16.0을 기준으로 작성했습니다. SDK 버전이 달라지면 기본 Integration이나 설정 이름이 달라질 수 있습니다.

## [sort1] 1. 배포된 앱의 오류는 어디에서 확인해야 할까

> “오류가 났는데 어떤 작업을 하다가 발생했는지는 잘 모르겠어요.”

배포된 애플리케이션에서 오류가 발생하면 자주 마주하던 상황이었습니다.

당시 Electron 기반 멀티미디어 에디터를 개발하고 있었습니다. 개발 환경에서는 Console과 Network 탭을 열어 오류 메시지와 실패한 요청을 바로 확인할 수 있었습니다.

하지만 사용자가 설치한 애플리케이션에서는 같은 방식으로 오류를 확인하기 어려웠습니다. 사용자가 직접 제보하더라도 어떤 화면에서 어떤 작업을 하다가 문제가 발생했는지 다시 물어봐야 했습니다.

기존에도 화면과 요청 단위의 오류 처리는 하고 있었습니다.

- React Error Boundary는 오류가 발생한 화면 대신 Fallback UI를 보여줬습니다.
- TanStack Query는 API 요청의 성공과 실패 상태를 관리했습니다.
- 개발 환경에서는 `console.error`로 오류를 확인했습니다.

문제는 **오류를 처리하는 것과 오류를 수집하는 것이 같은 일이 아니라는 점**이었습니다.

React Error Boundary가 오류 화면을 보여주고 `console.error`를 남기더라도 해당 정보는 사용자 PC 밖으로 전달되지 않았습니다. 따라서 오류가 발생해도 다음 질문에 바로 답하기 어려웠습니다.

- Main Process와 Renderer Process 중 어디에서 발생했는가
- 편집 화면과 관리 화면 중 어디에서 발생했는가
- React 렌더링 오류인가, API Query 오류인가
- 어떤 서비스와 HTTP 상태에서 실패했는가
- 실패한 Query가 이후 실행에서는 복구됐는가

처음에는 Sentry SDK를 설치하고 오류 객체를 전송하면 이 문제를 해결할 수 있을 것이라고 생각했습니다.

하지만 이 애플리케이션은 사용자가 작성한 문장과 로컬 미디어 파일을 다루고 있었습니다. 오류 객체를 그대로 전송하면 문제를 분석하는 데 필요하지 않은 사용자 데이터까지 함께 수집될 수 있었습니다.

단순히 오류를 더 많이 모으는 것이 이번 작업의 목표는 아니었습니다. 오류를 수집하기 전에 어떤 정보를 보내지 않을지 먼저 정해야 했습니다.

---

## [sort1] 2. 오류를 모으기 전에 보내지 않을 정보를 정했다

Sentry는 오류가 발생한 코드 위치와 실행 환경을 수집하고, 비슷한 오류 이벤트를 Issue로 묶어 추적할 수 있습니다.

하지만 이 프로젝트에서는 기본 수집 정보에 사용자 데이터가 포함될 가능성이 있었습니다.

- 오류 메시지에는 사용자가 작성한 문장이 포함될 수 있습니다.
- 요청 URL과 Query에는 프로젝트 ID가 포함될 수 있습니다.
- Stack Trace에는 사용자 이름이 포함된 전체 로컬 경로가 남을 수 있습니다.
- 요청 Header와 Body에는 인증 정보와 실제 작업 내용이 들어갈 수 있습니다.

[Sentry의 Logging Best Practices](https://blog.sentry.io/logging-best-practices/)도 Token, API Key, 전체 요청·응답 대신 문제 해결에 필요한 비민감 필드를 선택적으로 기록할 것을 권합니다.

따라서 이번 작업에서는 두 문제를 분리했습니다.

1. 오류를 분석할 수 있는가
2. 사용자 데이터를 제외할 수 있는가

Sentry를 선택한 이유도 이 두 요구사항을 함께 다룰 수 있었기 때문입니다.

- Electron Main·Renderer를 지원하는 공식 SDK가 있습니다.
- React Error Boundary에서 발생한 오류를 직접 전송할 수 있습니다.
- Tag와 Context로 오류를 분류할 수 있습니다.
- `beforeSend`에서 전송 직전 Event를 수정할 수 있습니다.
- 오류를 전송하면 Event ID를 반환받아 이후 실행 결과와 연결할 수 있습니다.

여기서 DSN(Data Source Name)은 오류 이벤트를 보낼 Sentry 프로젝트의 주소입니다. Event ID는 전송된 오류를 식별하는 값입니다.

Tag는 오류를 검색하고 분류하는 값이며, Context는 오류 분석에 필요한 추가 정보를 묶어 저장하는 영역입니다.

다른 모니터링 도구를 같은 조건으로 비교하지는 않았습니다. 따라서 Sentry가 항상 최선이라고 결론 내린 것은 아닙니다. 이번 프로젝트에서 필요한 오류 수집 방식과 전송 전 정제 기능을 제공하는 도구로 Sentry를 선택했습니다.

---

## [sort1] 3. Electron에서는 Main과 Renderer를 따로 초기화해야 한다

일반적인 React 애플리케이션에 오류 모니터링을 적용할 때는 Renderer의 진입점만 먼저 떠올리기 쉽습니다.

하지만 Electron 애플리케이션은 Main Process와 Renderer Process가 서로 다른 JavaScript 실행 환경에서 동작합니다.

```text
Electron Application
├─ Main Process
│  └─ 앱 생명주기와 창 관리
│
└─ Renderer Process
   └─ React 화면 렌더링
```

[Electron 공식 Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)은 두 프로세스를 별도의 실행 환경으로 설명합니다.

[Sentry Electron SDK](https://github.com/getsentry/sentry-electron)도 Main과 모든 Renderer 진입점에서 `init`을 가능한 한 일찍 호출하도록 안내합니다.

Renderer에만 Sentry를 적용하면 Main에서 발생한 JavaScript 오류를 같은 경로로 수집할 수 없습니다. 따라서 Main과 Renderer에 각각 초기화 코드를 추가했습니다.

### [sort2] 3-1. Main Process 초기화

이 프로젝트에는 `@sentry/electron` 7.16.0을 설치했습니다.

```bash
pnpm add @sentry/electron@7.16.0
```

Main 진입점의 첫 import에서 오류 모니터링 모듈을 불러왔습니다.

```ts
import './errorMonitoring';
```

초기화 함수는 DSN이 없으면 실행을 중단합니다.

```ts
export function initializeMainErrorMonitoring(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    includeLocalVariables: false,
    attachScreenshot: false,
    maxBreadcrumbs: 0,
    beforeSend: event => sanitizeErrorMonitoringEvent(event),
  });

  return true;
}
```

Main에서는 다음 정보를 수집하지 않도록 설정했습니다.

- 사용자 식별 정보
- Local Variable
- Screenshot
- Breadcrumb

Minidump Integration도 기본 Integration 목록에서 제외했습니다.

이번 작업의 범위를 JavaScript 오류로 제한한 선택이었습니다. 대신 Native Crash와 오류 직전의 사용자 행동은 확인할 수 없게 됐습니다.

### [sort2] 3-2. Renderer Process 초기화

Renderer에서는 React Root를 만들기 전에 Sentry를 초기화했습니다.

```tsx
initializeRendererErrorMonitoring();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
```

Renderer에도 `beforeSend` 정제 함수를 적용했습니다. 여기에 `process`, `window_role`, `feature`, `error_source`, `os` Tag를 추가해 오류가 발생한 실행 환경을 구분했습니다.

```ts
Sentry.setTags({
  feature: 'app',
  error_source: 'runtime',
  process: 'renderer',
  window_role: window.api.windowRole,
  os: navigator.platform || 'unknown',
});
```

DSN이 없을 때는 Main과 Renderer 모두 `Sentry.init`을 호출하지 않습니다. 다만 SDK 초기화를 생략하는 것이며, SDK 코드가 Bundle에서 완전히 제거된다는 의미는 아닙니다.

---

## [sort1] 4. 차단 목록 대신 허용 목록을 선택했다

오류 이벤트에서 민감한 값을 제거하는 방법을 두 가지로 나눠 비교했습니다.

| 방법      | 동작 방식                    | 비용과 한계                                       |
| --------- | ---------------------------- | ------------------------------------------------- |
| 차단 목록 | 알려진 민감 필드를 찾아 제거 | 새 필드가 추가되면 검토 없이 통과할 수 있음       |
| 허용 목록 | 코드에 등록한 필드만 유지    | 수집 기준과 테스트를 애플리케이션에서 관리해야 함 |

처음에는 오류 이벤트에서 사용자 정보로 보이는 필드만 제거하는 방식을 생각했습니다.

하지만 차단 목록(Blocklist)은 이미 알고 있는 필드만 제거할 수 있습니다. SDK나 애플리케이션 코드에 새로운 필드가 추가되면 별도 검토 없이 전송될 가능성이 있었습니다.

반면 허용 목록(Allowlist)은 코드에 등록한 필드만 통과시킵니다. 새로운 값은 기본적으로 버리고, 오류를 분석하는 데 필요한 이유를 확인한 뒤 목록에 추가할 수 있습니다.

이번 작업에서는 다음 원칙을 세웠습니다.

- Main과 Renderer 오류를 모두 수집합니다.
- 사용자 작성 내용과 인증 정보는 전송하지 않습니다.
- 검색과 분류에 필요한 값은 정형화합니다.
- 모니터링 실패가 애플리케이션 동작을 바꾸지 않게 합니다.
- DSN이 없으면 Sentry를 초기화하지 않습니다.

### [sort2] 4-1. Tag와 Context를 고정했다

전송할 수 있는 Tag 이름은 코드에 고정했습니다.

```ts
const ALLOWED_TAG_NAMES = ['process', 'window_role', 'feature', 'error_source', 'os', 'http_status'] as const;
```

Context도 오류 분석에 필요한 필드만 허용했습니다.

| Context  | 허용 필드                                   | 확인하려는 정보                   |
| -------- | ------------------------------------------- | --------------------------------- |
| React    | `component_stack`                           | 오류가 발생한 컴포넌트 계층       |
| Query    | `operation`                                 | 정적 Query 작업 이름              |
| HTTP     | `method`, `service`, `path_template`        | 실제 식별자를 제거한 요청 분류    |
| Recovery | `retried_at`, `result`, `original_event_id` | 이후 실행 결과와 이전 오류의 연결 |

반대로 다음 정보는 제거했습니다.

- `user`, `request`, `extra`
- Breadcrumb
- 허용 목록에 없는 Tag와 Context
- 오류 원문
- 파일명과 전체 로컬 경로
- Stack Frame의 코드 문맥

Stack Frame에서는 `function`, `lineno`, `colno`, `in_app`만 남겼습니다.

```ts
const ALLOWED_STACK_FRAME_FIELDS = ['function', 'lineno', 'colno', 'in_app'] as const;
```

오류 문자열을 통해 사용자가 작성한 문장이나 로컬 경로가 전송될 가능성을 줄이기 위해 오류 메시지도 고정 문구로 바꿨습니다.

이 선택에는 대가도 있었습니다. 원래 오류 메시지와 파일 정보를 볼 수 없기 때문에 원인 분석이 더 어려워질 수 있습니다. 이번 단계에서는 진단 편의보다 정보 최소화를 우선했습니다.

> 허용 목록은 개인정보 보호 설정이면서, 어떤 정보로 오류를 진단할지 정의하는 Event Schema이기도 했습니다.

---

## [sort1] 5. React 렌더링 오류에 화면 맥락을 추가했다

기존 Error Boundary의 Fallback UI는 그대로 유지했습니다. 대신 `onError`에서 Sentry로 오류 이벤트를 전송했습니다.

```ts
captureReactError(error, {
  componentStack: errorInfo.componentStack ?? '',
  feature,
});
```

JavaScript Stack만으로는 오류가 어떤 UI 계층에서 발생했는지 충분히 확인하기 어려울 수 있습니다.

React의 `componentStack`에는 오류를 던진 컴포넌트와 부모 컴포넌트가 포함됩니다. 따라서 렌더링 오류가 발생한 화면 구조를 함께 확인할 수 있습니다. 자세한 내용은 [React Error Boundary 문서](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)에서 확인할 수 있습니다.

다만 `componentStack`에도 로컬 경로가 포함될 수 있었습니다. 이 프로젝트에서는 경로를 `[redacted-path]`로 치환한 뒤 Context에 저장했습니다.

편집 화면에는 `studio`, 관리 화면에는 `admin`이라는 `feature` Tag를 전달했습니다.

```text
같은 React 오류
├─ feature=studio
└─ feature=admin
```

이제 같은 종류의 렌더링 오류도 어느 기능 영역에서 발생했는지 나눠서 검색할 수 있습니다.

---

## [sort1] 6. Query 오류와 이후 실행 결과를 연결했다

API Query마다 오류 전송 코드를 반복해서 추가하면 수집 기준이 달라질 수 있었습니다.

따라서 각 Query에서 개별적으로 처리하지 않고 `QueryCache`의 전역 `onError`와 `onSuccess`를 사용했습니다.

```ts
const queryCache = new QueryCache({
  onError: (error, query) => {
    // 오류 Event를 전송하고 Event ID를 queryHash에 연결합니다.
  },
  onSuccess: (_data, query) => {
    // 이전 오류가 있다면 이후 성공 Event를 전송합니다.
  },
});
```

### [sort2] 6-1. 자동 재시도와 이후 실행을 구분했다

여기서 “재시도”의 의미를 먼저 구분할 필요가 있었습니다.

이 프로젝트의 Query 설정은 `retry: 1`입니다. 첫 번째 실행이 실패하면 TanStack Query가 한 번 더 실행합니다.

`QueryCache.onError`는 이 자동 재시도까지 실패해 Query가 오류 상태가 된 뒤 호출됩니다.

```text
Query 실행
  → 자동 재시도까지 실패
  → QueryCache.onError
  → 오류 Event ID 저장
  → 이후 같은 queryHash가 다시 실행됨
      ├─ 성공: result=success
      └─ 실패: result=failure
```

따라서 개별 자동 재시도마다 오류 이벤트를 남기는 구조는 아닙니다.

오류 상태가 된 Query와 이후 같은 `queryHash`로 실행된 결과를 연결했습니다. 이후 실행은 사용자의 다시 시도나 별도 Refetch로 발생할 수 있습니다.

`original_event_id`는 애플리케이션에서 추가한 상관관계 필드입니다. Sentry Trace의 부모·자식 관계를 만드는 값은 아닙니다.

### [sort2] 6-2. Query와 HTTP 정보에서 동적 값을 제거했다

Query Key 전체도 전송하지 않았습니다. 첫 번째 정적 문자열만 `operation`으로 사용하고, 프로젝트 ID처럼 뒤에 붙는 동적 값은 제외했습니다.

HTTP URL도 실제 값 대신 Template으로 변환했습니다.

```text
/studio/projects/secret-project/assets
→ /studio/projects/:value/assets
```

HTTP Method와 서비스 분류, HTTP 상태는 남겼습니다. 반면 Header, Body, 실제 ID는 오류 전송을 감싼 공통 모듈인 Reporter에 전달하지 않았습니다.

| 남기는 정보     | 제외하는 정보 |
| --------------- | ------------- |
| `method`        | Header        |
| `service`       | Body          |
| `path_template` | 실제 URL      |
| `http_status`   | 프로젝트 ID   |

요청을 분류하는 정보는 남기고 실제 식별자와 요청 내용은 전송하지 않는 기준이었습니다.

---

## [sort1] 7. 모니터링 실패가 제품 오류가 되지 않게 했다

Sentry는 제품 기능이 아니라 오류 진단을 돕는 부가 기능입니다.

오류 이벤트 전송에 실패했다고 Query의 성공과 실패 결과가 달라져서는 안 됩니다.

```ts
try {
  return reporter.captureError(error, details);
} catch {
  return undefined;
}
```

복구 이벤트 전송도 같은 방식으로 격리했습니다. Reporter가 예외를 던지더라도 성공한 Query는 성공 상태를 유지합니다.

테스트에서는 Reporter가 실패했을 때 호출자가 원래 애플리케이션 오류 객체를 그대로 받는지 확인했습니다.

단순히 모니터링 오류를 무시한 것이 아니었습니다. 제품의 오류 경로와 모니터링의 오류 경로를 분리해 모니터링 기능이 애플리케이션의 동작을 바꾸지 않도록 했습니다.

---

## [sort1] 8. 릴리스 빌드에 DSN을 연결했다

로컬 코드에서 초기화가 동작하더라도 릴리스 빌드에 DSN이 전달되지 않으면 실제 배포 환경에서는 Sentry가 초기화되지 않습니다.

따라서 Release Workflow에 GitHub Actions Repository Variable을 연결했습니다.

```yaml
VITE_SENTRY_DSN: ${{ vars.VITE_SENTRY_DSN }}
```

`VITE_*` 환경 변수는 Build 시 Client Bundle에 포함됩니다.

GitHub Secret에 저장하더라도 최종 Electron Renderer Bundle에서 비밀로 유지할 수 없습니다. [Vite 문서](https://vite.dev/guide/env-and-mode)도 `VITE_*`에 비밀번호나 API Token 같은 민감 정보를 넣지 말라고 설명합니다.

Sentry DSN은 오류 이벤트를 보낼 프로젝트를 가리키는 Client Key입니다. 관리자 API Token과는 권한이 다릅니다.

다만 외부에서 불필요한 이벤트를 보내는 데 사용될 가능성은 남습니다. 실제 이벤트 양을 확인한 뒤 Rate Limit과 필터 정책을 정할 필요가 있습니다.

---

## [sort1] 9. 무엇을 확인했고, 무엇이 남았을까

### [sort2] 9-1. 코드와 테스트에서 확인한 내용

구현 코드와 테스트에서는 다음 내용을 확인했습니다.

- Main과 Renderer에 초기화 코드가 추가됐습니다.
- DSN이 없으면 `Sentry.init`을 호출하지 않습니다.
- 허용하지 않은 요청·사용자·경로 필드를 제거합니다.
- 같은 `queryHash`의 이후 성공과 실패를 이전 Event ID와 연결합니다.
- Reporter 실패가 원래 Query 오류를 대체하지 않습니다.
- Release Workflow가 `VITE_SENTRY_DSN`을 주입합니다.

구현을 마친 뒤 다음 명령으로 동작을 검증했습니다.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build:production
```

당시 실행 결과에서 테스트, Type Check, Lint, Production Build가 통과했습니다.

### [sort2] 9-2. 운영 효과는 새 Release에서 확인해야 한다

이 글을 작성한 시점에는 Sentry Dashboard에서 실제 운영 이벤트를 확인하지 못했습니다.

따라서 다음 효과가 발생했다고 결론 내릴 수는 없습니다.

- 오류 해결 시간이 줄었습니다.
- 사용자 환경 오류의 재현 성공률이 높아졌습니다.
- 이벤트 양과 비용이 적절해졌습니다.

현재 확인된 범위는 구현, 단위 테스트, Build 설정까지입니다. 실제 운영 효과는 새 Release에서 Main과 Renderer의 오류 이벤트를 확인한 뒤 판단해야 합니다.

### [sort2] 9-3. Source Map 적용에는 추가 식별 전략이 필요하다

현재 정제 함수는 Stack Frame의 `filename`과 `abs_path`를 제거합니다.

반면 [Sentry의 Source Map 문제 해결 문서](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/)는 Frame의 `abs_path`와 배포 파일의 `code_file`을 매칭에 사용한다고 설명합니다.

두 조건을 함께 보면 현재 이벤트 형태만으로는 문서에서 설명한 기본 매칭 방식을 적용하기 어렵습니다.

Source Map 파일을 업로드하는 것과 함께, 사용자 로컬 경로를 노출하지 않으면서 Release와 Bundle을 식별할 수 있는 값도 설계해야 합니다.

이 부분은 아직 구현하지 않았습니다. 실제 Package와 Event Payload를 확인하기 전에는 어떤 식별 방식이 동작할지 단정할 수 없습니다.

---

## [sort1] 10. 회고

이번 작업에서 가장 오래 고민한 부분은 Sentry SDK를 설치하는 방법이 아니었습니다.

어떤 정보를 수집해야 오류를 분류할 수 있고, 어떤 정보는 사용자 데이터가 될 수 있어 제외해야 하는지 경계를 정하는 일이 핵심이었습니다.

많은 정보를 수집할수록 오류 원인을 찾기는 쉬워질 수 있습니다. 하지만 사용자 작업을 다루는 데스크톱 애플리케이션에서는 개인정보 노출 위험과 이벤트 비용도 함께 커질 수 있습니다.

반대로 정보를 지나치게 제거하면 오류 모니터링을 도입하고도 다시 사용자에게 상황을 물어봐야 할 수 있습니다.

이번 구조에서는 Process, 기능 영역, Query 작업, HTTP 상태처럼 오류를 검색하고 분류하는 데 필요한 정보는 남겼습니다.

사용자가 작성한 문장과 실제 프로젝트 ID, 요청 본문, 전체 로컬 경로는 전송 대상에서 제외했습니다.

다만 이 경계가 실제 운영에서도 충분한지는 아직 확인하지 못했습니다. 새 Release에서 실제 Event Payload를 확인한 뒤 허용 목록과 Source Map 식별 방식을 다시 조정해야 합니다.

> 좋은 오류 모니터링은 모든 정보를 복사하는 시스템이 아니라, 다음 조사를 시작할 수 있는 단서를 안전하게 남기는 시스템이라고 생각합니다.

이번 작업을 통해 오류 수집 도구를 선택하는 기준뿐 아니라, 관측 가능성과 사용자 데이터 보호 사이의 경계를 코드로 관리하는 기준을 정리할 수 있었습니다.

---

## [sort1] 11. 참고한 글

- [서비스 에러 모니터링, 프론트엔드에 Sentry 붙여보기](https://velog.io/@ssuminii/%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%97%90%EB%9F%AC-%EB%AA%A8%EB%8B%88%ED%84%B0%EB%A7%81-%ED%94%84%EB%A1%A0%ED%8A%B8%EC%97%94%EB%93%9C%EC%97%90-Sentry-%EB%B6%99%EC%97%AC%EB%B3%B4%EA%B8%B0)
- [Sentry로 우아하게 프론트엔드 에러 추적하기](https://tech.kakaopay.com/post/frontend-sentry-monitoring/)
- [Next.js에서 Sentry로 프론트엔드 에러 모니터링하기](https://www.postype.com/en/@team/post/18407805)
- [선제적 장애 대응을 위한 Sentry 최적화 적용기](https://techblog.woowahan.com/21604/)
- [프론트엔드에서 에러 처리하기 - SENTRY](https://hyermione.tistory.com/5)
