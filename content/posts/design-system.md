---
title: '디자인 시스템을 npm 패키지 대신 shadcn Registry로 배포한 이유'
description: 'micro SaaS 환경에서 npm 패키지 대신 shadcn Registry를 선택한 이유와 구현 기준을 정리합니다.'
date: '2026-07-10'
tags: ['design-system', 'shadcn', 'tokens-studio', 'frontend', 'architecture']
draft: false
featured: true
---

## [sort1] 1. 왜 디자인 시스템이 필요했는가

디자인 시스템은 여러 제품에서 반복해서 사용하는 UI 기준이다. 색상과 간격 같은 **디자인 토큰(design token)**, Button과 Dialog 같은 컴포넌트, 접근성 규칙을 함께 관리한다. [Figma는 디자인 시스템을 재사용 가능한 컴포넌트, 가이드라인, 도구의 모음](https://www.figma.com/resource-library/design-system-examples/)으로 설명한다.

우리에게 디자인 시스템이 필요했던 이유는 화면을 더 예쁘게 만들기 위해서가 아니었다. 제품이 늘어날 때마다 같은 결정을 반복하고 있었기 때문이다.

예를 들어 제품마다 다음 기준이 달랐다.

- Button의 `disabled` 상태에서 hover와 cursor를 어떻게 처리할지
- TextField의 `error`, `focused`, `disabled` 상태를 어떤 이름으로 표현할지
- Figma의 variant 이름과 코드의 prop 이름을 어떻게 맞출지

차이가 쌓이면 개발자는 UI를 만들기 전에 “어느 구현이 기준인가?”부터 확인해야 한다. 그래서 다음 제품이 같은 문제를 다시 풀지 않도록 공통 출발점을 만들기로 했다.

다만 모든 제품을 똑같이 만들고 싶지는 않았다. 우리가 운영하는 micro SaaS는 빠르게 만들고 검증해야 했다. 제품에 맞게 UI를 바꿀 자유도 필요했다.

> 우리의 목표는 모든 UI를 통제하는 것이 아니라, 검증된 기본값에서 빠르게 시작하는 것이었다.

## [sort1] 2. 가장 먼저 정한 것은 컴포넌트의 소유권이었다

처음에는 디자인 시스템을 npm 패키지로 만들려고 했다.

```tsx
import { Button } from '@editor/design-system';

export function SaveButton() {
  return <Button variant="primary">저장</Button>;
}
```

익숙하고 관리하기 쉬운 방식처럼 보였다. 하지만 구현을 시작하기 전에 한 가지 질문을 먼저 정해야 했다.

> 설치한 컴포넌트를 디자인 시스템이 계속 소유할 것인가, 각 프로젝트가 소유할 것인가?

이 질문이 중요한 이유는 소유권에 따라 수정 방법이 달라지기 때문이다.

- npm 패키지는 원본 패키지가 구현을 소유한다. 프로젝트는 공개된 API 안에서 사용한다.
- Registry는 소스 파일을 프로젝트 안에 설치한다. 설치 후에는 프로젝트가 구현을 소유한다.

소유권이 정해져야 버전 관리, 프로젝트별 수정, 업데이트 방법도 정할 수 있다. 그래서 디자인 토큰이나 컴포넌트 목록보다 배포 방식을 먼저 결정했다.

## [sort1] 3. npm 패키지와 Registry는 무엇이 다른가

여기서 **npm 패키지 방식**은 UI 컴포넌트를 패키지로 배포하고, 각 프로젝트가 의존성으로 설치해 `import`하는 방식을 뜻한다.

반면 [shadcn Registry](https://ui.shadcn.com/docs/registry)는 CLI로 컴포넌트와 설정 파일을 프로젝트에 설치하는 코드 배포 방식이다.

```bash
pnpm dlx shadcn@latest add https://editor-ui.internal/r/button.json
```

설치가 끝나면 Button은 프로젝트 안의 파일이 된다.

```text
src/components/ui/button.tsx
src/styles/editor-tokens.css
```

두 방식을 같은 기준으로 비교하면 차이가 분명해진다.

| 기준            | npm 패키지                          | shadcn Registry                       |
| --------------- | ----------------------------------- | ------------------------------------- |
| 설치 결과       | `node_modules`의 패키지를 참조한다. | 프로젝트 안에 소스 파일이 생긴다.     |
| 구현 소유권     | 원본 패키지가 가진다.               | 설치한 프로젝트가 가진다.             |
| 프로젝트별 수정 | 공개 API나 확장 지점이 필요하다.    | 소스 코드를 직접 수정할 수 있다.      |
| 업데이트        | 패키지 버전을 올려서 받는다.        | 원본 변경이 자동으로 반영되지 않는다. |
| 일관성          | 중앙에서 유지하기 쉽다.             | 프로젝트마다 구현이 달라질 수 있다.   |

어느 방식이 더 좋은지는 운영 조건에 따라 달라진다.

```text
장기 운영 제품이 많고 중앙 관리가 중요하다
→ npm 패키지가 더 적합할 수 있다.

빠른 도입과 프로젝트별 수정이 중요하다
→ Registry가 더 적합할 수 있다.
```

## [sort1] 4. 왜 우리에게는 Registry가 더 맞았는가

우리가 운영하던 제품군에는 빠르게 만들고 검증하는 micro SaaS가 많았다. 같은 Button을 오래 공유하는 것보다, 쓸 만한 Button으로 시작해 제품에 맞게 바로 수정하는 일이 더 중요했다.

npm 패키지에 제품별 요구를 모두 넣으면 공통 API가 복잡해질 수 있다.

```tsx
<Button variant="primary" loadingPlacement="left" trackingEvent="project_create_click" projectSpecificRadius="compact">
  생성하기
</Button>
```

이런 prop이 항상 잘못된 것은 아니다. 여러 제품에서 반복해서 필요하다면 공통 API가 될 수 있다. 하지만 한 제품만을 위한 옵션이 계속 쌓이면 공통 컴포넌트가 제품별 정책까지 맡게 된다.

Registry에서는 기본 구현을 설치한 뒤 프로젝트가 직접 바꿀 수 있다. 공통 API에 모든 예외를 추가하지 않아도 된다. 이 점이 우리의 운영 방식과 더 잘 맞았다.

대신 비용도 있다.

- 원본을 수정해도 이미 설치한 프로젝트에는 자동으로 반영되지 않는다.
- 같은 이름의 컴포넌트가 프로젝트마다 다르게 동작할 수 있다.
- 수정 후에도 접근성과 디자인 토큰 규칙을 각 프로젝트가 검증해야 한다.

따라서 Registry를 선택했다는 사실만으로 유지보수 비용이 줄어든다고 단정할 수는 없다. 우리는 중앙 업데이트의 편리함보다 빠른 도입과 수정 가능성을 우선했다.

## [sort1] 5. shadcn, Radix UI, Emotion의 역할을 나눴다

“shadcn을 사용한다”는 말은 shadcn/ui의 디자인과 Tailwind 구현을 그대로 쓴다는 뜻이 아니다. 우리는 **Registry와 CLI를 이용한 소스 코드 배포 방식만 사용**하기로 했다.

기존 Electron 앱은 Emotion을 사용하고 있었다. Tailwind를 함께 도입하면 스타일 작성과 디버깅 방법이 두 개가 된다. 그래서 기존 스타일 도구는 유지하고 각 도구의 책임만 나눴다.

| 도구            | 맡은 역할                                              |
| --------------- | ------------------------------------------------------ |
| shadcn Registry | 컴포넌트 소스 파일과 의존성 배포                       |
| Radix UI        | Dialog, DropdownMenu, Tooltip의 접근성 구조와 상호작용 |
| Emotion         | React 컴포넌트 스타일 작성                             |
| CSS 변수        | 프레임워크가 공유할 디자인 토큰 제공                   |
| Vite            | 컴포넌트 개발용 playground와 문서 화면 실행            |

[Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/accessibility)는 WAI-ARIA 지침을 바탕으로 `aria`, `role`, 초점 관리, 키보드 이동 같은 구현을 제공한다. 그래서 Dialog처럼 상호작용이 복잡한 컴포넌트의 기반으로 사용했다.

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
import styled from '@emotion/styled';

const DialogContent = styled(DialogPrimitive.Content)`
  background: var(--editor-color-surface-floating);
  border-radius: var(--editor-radius-medium);
`;
```

Radix UI를 사용한다고 접근성이 자동으로 완성되는 것은 아니다. Dialog 제목과 설명을 제공하고, 수정한 상호작용을 다시 확인하는 책임은 프로젝트에 남는다.

## [sort1] 6. 디자인 토큰은 CSS 변수로 공유했다

**디자인 토큰**은 색상, 간격, 글자 크기, 모서리 반경 같은 UI 값을 이름으로 관리하는 규칙이다.

현재는 React를 먼저 지원하지만 Vue 프로젝트도 있다. 토큰을 Emotion theme에만 넣으면 다른 프레임워크에서 다시 만들어야 한다. 그래서 컴포넌트 스타일은 Emotion으로 작성하고, 공통 값은 CSS 변수로 분리했다.

```css
:root {
  --editor-color-surface-primary: #ffffff;
  --editor-color-text-primary: #000000;
  --editor-radius-small: 1px;
  --editor-radius-medium: 2px;
}

[data-theme='dark'] {
  --editor-color-surface-primary: #2c2c2c;
  --editor-color-text-primary: #ffffff;
}
```

```tsx
const ButtonRoot = styled.button`
  background: var(--editor-color-interactive-button-primary-enabled);
  color: var(--editor-color-text-on-dark);
  border-radius: var(--editor-radius-small);

  &:hover {
    background: var(--editor-color-interactive-button-primary-hovered);
  }
`;
```

이렇게 나누면 React와 Vue가 같은 토큰 이름을 사용할 수 있다. 다만 실제로 두 프레임워크가 모든 토큰을 문제없이 공유하는지는 구현 과정에서 검증해야 한다.

## [sort1] 7. Tokens Studio를 GitHub와 연결했다

CSS 변수로 토큰을 만들었지만, 디자이너가 Figma에서 바꾼 값을 개발자가 다시 옮기는 과정은 남아 있었다. 이 수작업을 없애기 위해 Figma의 Tokens Studio와 GitHub 저장소를 연결했다.

[Tokens Studio의 GitHub Sync Provider](https://docs.tokens.studio/token-storage/remote/sync-git-github)는 GitHub의 토큰 JSON을 Figma로 Pull하고, Figma에서 바꾼 값을 GitHub로 Push하는 양방향 동기화를 지원한다.

여기서 사용하는 **GitHub Personal Access Token(PAT)**은 디자인 토큰이 아니다. Tokens Studio가 저장소를 읽고 쓰기 위해 사용하는 GitHub 인증 정보다.

우리는 다음 기준으로 fine-grained PAT를 만들었다.

```text
Repository access
→ AnAIAudio/AnAI-Designe-System만 선택

Repository permissions
→ Contents: Read and write
```

PAT는 비밀번호와 같은 인증 정보이므로 Figma 설명, 문서, 채팅, Git 커밋에 남기지 않는다. 또한 디자이너 개인 PAT와 GitHub Actions의 자동화용 secret은 역할이 다르다. 플러그인은 디자이너 PAT로 `tokens.json`을 Push하고, GitHub Actions는 저장소 관리자가 등록한 별도 secret으로 PR 생성과 병합을 수행한다.

Tokens Studio에서는 작업용 Figma 복사본을 열고 다음 값을 등록했다.

```text
Settings
  → Sync providers
  → Add new
  → GitHub

Name: Dyna Tokens
Repository: AnAIAudio/AnAI-Designe-System
Branch: feature/tokens-studio-sync
Token storage location: tokens.json
Base URL: 비워두기
```

무료 버전에서는 Token Storage Location을 단일 파일인 `tokens.json`으로 설정했다. 공식 문서 기준으로 폴더 기반 multi-file sync는 Pro 기능이다. 단일 파일 방식은 모든 Token Set을 하나의 JSON에 저장한다.

최초 연결에서는 GitHub의 `tokens.json`을 기준으로 `Pull`했다. 반대로 Push를 선택하면 Figma에 남아 있던 값이 저장소의 기준을 덮어쓸 수 있기 때문이다.

이후 작업 순서는 단순해졌다.

```text
작업 시작 전 Pull
  → Figma 복사본에서 토큰 값 변경
  → Save
  → Diff 확인
  → 커밋 메시지 작성
  → Push changes
  → GitHub Actions 검증
  → main 대상 PR 병합
```

[Tokens Studio의 Push/Pull 문서](https://docs.tokens.studio/token-storage/remote-push-pull-changes)에 따르면 Pull은 플러그인의 현재 토큰을 원격 저장소 값으로 교체한다. Push하지 않은 로컬 변경은 잃을 수 있으므로 작업 시작 전에 Pull하고, 변경 중에는 어느 쪽이 최신인지 먼저 확인한다.

원본 Figma 파일은 수정하지 않았다. 작업용 복사본에서만 Tokens Studio의 `Apply`를 실행했다. 현재 자동화 범위도 토큰에 한정했다. Figma의 component, variant, layer 변경은 코드로 자동 변환되지 않는다.

> GitHub 연결의 핵심은 Figma를 원본으로 만드는 것이 아니라, 버전 관리되는 `tokens.json`을 디자인과 코드가 함께 사용하는 기준으로 만드는 것이었다.

## [sort1] 8. Figma와 코드가 같은 이름을 쓰게 했다

Figma와 코드가 같은 컴포넌트를 서로 다른 이름으로 부르면 다시 확인하는 시간이 생긴다. 그래서 구현 전에 다음 항목을 맞추기로 했다.

- Figma의 component 이름과 코드의 component 이름
- Figma의 variant와 React prop
- hover, focus 같은 상호작용 상태와 CSS pseudo-class
- Figma token과 CSS 변수 이름

예를 들어 Figma에는 다음과 같은 variant가 있을 수 있다.

```text
Color=Primary, Size=Large, State=Hovered
```

코드에서는 사용자가 정하는 값과 브라우저 상태를 나눈다.

```tsx
<Button variant="primary" size="large">
  저장
</Button>
```

`Hovered`는 prop으로 받지 않고 `:hover`로 처리한다. Figma와 코드의 표현 방식은 달라도 같은 의미를 가리켜야 한다.

## [sort1] 9. 작은 범위부터 검증하기로 했다

처음부터 모든 컴포넌트를 만들지 않았다. 먼저 아래 범위로 시작하기로 했다.

```text
디자인 토큰
- color
- radius

기본 컴포넌트
- Icon
- Button
- IconButton
- TextField
- Divider

Radix UI 기반 컴포넌트
- Dialog
- DropdownMenu
- Tooltip
```

Button과 TextField를 먼저 고른 이유는 작은 범위에서 variant, size, disabled, focus, error, icon, 디자인 토큰 연결을 함께 확인할 수 있기 때문이다.

[Storybook](https://storybook.js.org/docs)은 앱과 분리된 환경에서 컴포넌트 상태를 실행하고 테스트하는 도구로 사용한다. 배포는 Registry가 맡고, 설치 전 원본 검증은 Storybook이 맡는다.

확인할 항목은 다음과 같다.

- Button과 TextField의 모든 상태가 의도대로 보이는가
- 키보드만으로 Dialog와 메뉴를 사용할 수 있는가
- Figma variant와 코드 prop이 같은 의미를 가지는가
- Registry로 설치한 파일과 의존성이 올바른 위치에 생기는가
- 프로젝트가 수정한 뒤에도 접근성과 토큰 규칙이 유지되는가

## [sort1] 10. 언제 이 결정을 다시 검토할 것인가

Registry는 현재 제품 운영 방식에 맞춘 선택이다. 다음 조건이 생기면 npm 패키지를 다시 검토할 수 있다.

- 여러 장기 운영 제품이 같은 구현을 계속 유지해야 할 때
- 보안 수정이나 접근성 수정이 모든 제품에 빠르게 전파되어야 할 때
- 프로젝트별 차이보다 중앙 API의 안정성이 더 중요해질 때
- 설치된 코드의 차이를 추적하는 비용이 커질 때

반대로 프로젝트별 실험과 수정이 계속 중요하다면 Registry 방식의 장점이 유지된다.

## [sort1] 11. 마치며

처음에는 디자인 시스템을 만들면 npm 패키지부터 배포해야 한다고 생각했다. 하지만 우리에게 더 중요한 질문은 패키지 형식이 아니라 컴포넌트의 소유권이었다.

우리는 중앙 업데이트와 구현 일관성의 일부를 포기했다. 대신 각 프로젝트가 검증된 코드를 빠르게 설치하고 직접 수정할 수 있게 했다.

> 좋은 디자인 시스템은 모든 변화를 막는 규칙이 아니라, 다음 제품이 같은 문제를 다시 풀지 않게 만드는 출발점이어야 한다.

## 참고 자료

- [Figma가 설명하는 디자인 시스템의 기본 개념](https://www.figma.com/resource-library/design-system-examples/)
- [Figma가 설명하는 디자인 토큰의 역할](https://www.figma.com/resource-library/design-tokens/)
- [npm 공식 문서의 package와 module 개념](https://docs.npmjs.com/about-packages-and-modules/)
- [shadcn/ui Registry의 구조와 역할](https://ui.shadcn.com/docs/registry)
- [shadcn/ui Registry 시작 방법](https://ui.shadcn.com/docs/registry/getting-started)
- [Radix Primitives의 접근성 원칙](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Storybook 공식 문서](https://storybook.js.org/docs)
- [Tokens Studio의 GitHub Sync Provider 설정](https://docs.tokens.studio/token-storage/remote/sync-git-github)
- [Tokens Studio의 Push와 Pull 동작](https://docs.tokens.studio/token-storage/remote-push-pull-changes)
