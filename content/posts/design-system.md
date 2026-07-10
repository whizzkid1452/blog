# [Part 1.] 디자인 시스템을 npm 패키지가 아니라 Registry로 만들기로 했다

## 개요

디자인 시스템을 만들겠다고 생각하면 자연스럽게 `@company/design-system` 같은 npm package를 떠올리게 된다.

나도 처음에는 그렇게 생각했다. Button, TextField, Dialog 같은 컴포넌트를 하나의 패키지로 묶고, 각 프로젝트에서 import해서 쓰는 구조가 가장 정석처럼 보였다.

```tsx
import { Button } from '@dyna/design-system';

export function SaveButton() {
  return <Button variant="primary">저장</Button>;
}
```

그런데 Dyna의 실제 프로젝트 환경을 놓고 다시 생각해보니, 이 방식이 항상 맞는 것은 아니었다. 우리는 빠르게 만들고, 빠르게 배포하고, 때로는 빠르게 사라지는 micro SaaS 프로젝트가 많다. 이런 환경에서는 중앙에서 모든 컴포넌트를 강하게 통제하는 방식보다, 좋은 초기 구현을 제공하고 각 프로젝트가 자기 맥락에 맞게 수정할 수 있는 구조가 더 현실적일 수 있다.

그래서 이번 글에서는 디자인 시스템을 **라이브러리 패키지 방식**이 아니라 **shadcn-style registry 방식**으로 설계하기로 한 판단 과정을 정리하려고 한다.

## 1. 처음 고민은 배포 방식에서 시작됐다

디자인 시스템을 만든다는 말 안에는 여러 문제가 섞여 있다.

- 어떤 token을 만들 것인가
- Button API는 어떻게 정할 것인가
- Figma와 코드를 어떻게 맞출 것인가
- Storybook을 쓸 것인가
- React와 Vue를 모두 지원할 것인가
- npm package로 배포할 것인가, source code를 복사하게 할 것인가

이 중에서 가장 먼저 정해야 했던 것은 **배포 방식**이었다.

배포 방식이 정해져야 컴포넌트의 소유권이 정해진다. 컴포넌트의 소유권이 정해져야 versioning, customization, migration 전략도 정해진다.

여기서 선택지는 크게 두 가지였다.

```text
1. 라이브러리 패키지 방식
2. Registry 기반 코드 복사 방식
```

## 2. 라이브러리 패키지 방식은 왜 매력적으로 보였나

라이브러리 패키지 방식은 익숙하다. 디자인 시스템을 하나의 npm package로 만들고, 각 프로젝트가 그것을 설치해서 사용한다.

```bash
pnpm add @dyna/design-system
```

```tsx
import { Button, TextField } from '@dyna/design-system';
```

이 방식의 장점은 명확하다.

| 항목          | 내용                                                          |
| ------------- | ------------------------------------------------------------- |
| versioning    | `@dyna/design-system@1.2.0`처럼 버전을 명확히 관리할 수 있다. |
| 중앙 업데이트 | 버그를 한 번 고친 뒤 각 앱이 package version만 올리면 된다.   |
| 일관성        | 여러 앱의 Button 구현이 쉽게 갈라지지 않는다.                 |
| 계약 관리     | 디자인 시스템 팀이 component API를 중앙에서 관리하기 좋다.    |

특히 장기 운영되는 제품이 많고, 여러 팀이 같은 UI 규칙을 오래 유지해야 한다면 이 방식이 강하다.

하지만 이 장점은 동시에 비용이 된다.

## 3. 패키지 방식의 비용은 micro SaaS에서 더 크게 느껴졌다

우리의 맥락은 조금 달랐다. 사내에는 빠르게 만들고 배포했다가 사라지는 micro SaaS 프로젝트가 많다.

이런 프로젝트에서는 “모든 앱이 같은 Button 구현을 영원히 공유한다”는 목표보다, “처음부터 쓸만한 Button을 빠르게 가져오고, 필요하면 바로 고친다”는 목표가 더 중요할 수 있다.

패키지 방식에서는 프로젝트별 요구사항이 생길 때마다 선택지가 좁아진다.

예를 들어 어떤 micro SaaS에서는 Button에 tracking event가 필요하고, 다른 프로젝트에서는 loading icon 위치가 달라야 하고, 또 다른 프로젝트에서는 특정 화면에서만 radius를 바꿔야 한다고 해보자.

패키지 방식에서는 이런 요구가 계속 prop으로 올라오기 쉽다.

```tsx
<Button variant="primary" loadingPlacement="left" trackingEvent="project_create_click" projectSpecificRadius="compact">
  생성하기
</Button>
```

처음에는 유연해 보이지만, 시간이 지나면 공통 컴포넌트가 각 프로젝트의 예외를 떠안는다. 그리고 어느 순간 Button은 제품 공통 컴포넌트가 아니라 옵션이 너무 많은 추상화가 된다.

여기서 깨달은 점은 단순했다.

> 중앙에서 오래 관리할 컴포넌트와, 프로젝트가 빠르게 소유해야 하는 컴포넌트는 배포 방식이 달라야 한다.

## 4. shadcn 방식은 무엇이 다른가

shadcn 방식은 일반적인 npm package 방식과 다르다.

npm package 방식에서는 컴포넌트 코드가 `node_modules` 안에 있고, 앱은 그 코드를 참조한다.

```text
node_modules/@dyna/design-system/Button
```

반면 shadcn-style registry 방식에서는 CLI가 컴포넌트 소스 코드를 프로젝트 안으로 복사한다.

```bash
pnpm dlx shadcn@latest add https://dyna-ui.internal/r/button.json
```

복사 후에는 앱 내부 파일이 된다.

```text
src/components/ui/button.tsx
src/styles/dyna-tokens.css
```

정확히 말하면 이 방식은 **source-code distribution**이다. 더 좁게 표현하면 **registry 기반 코드 복사 방식**이다.

이 차이가 중요하다.

패키지 방식에서는 컴포넌트의 소유자가 디자인 시스템 패키지다.

Registry 방식에서는 복사된 순간부터 컴포넌트의 소유자가 해당 프로젝트다.

## 5. Registry 방식의 장점과 포기하는 것

Registry 방식의 장점은 우리 상황에서 꽤 직접적이었다.

| 항목               | 내용                                                          |
| ------------------ | ------------------------------------------------------------- |
| 빠른 수정          | 컴포넌트 코드가 앱 안에 있으므로 바로 수정할 수 있다.         |
| 필요한 만큼만 사용 | 필요한 컴포넌트나 block만 가져올 수 있다.                     |
| 낮은 불투명성      | opaque dependency가 줄고 코드 이해가 쉽다.                    |
| 프로젝트 적응성    | 앱의 폴더 구조, import alias, 스타일 규칙에 맞게 바꾸기 쉽다. |

하지만 이 방식이 무조건 좋은 것은 아니다. 확실히 포기하는 것도 있다.

| 항목           | 내용                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| 중앙 업데이트  | registry 원본을 고쳐도 기존 프로젝트 코드가 자동으로 바뀌지 않는다.     |
| 구현 일관성    | 여러 프로젝트의 Button 코드가 서로 달라질 수 있다.                      |
| migration 추적 | package version처럼 변경 이력을 강하게 추적하기 어렵다.                 |
| 품질 보장      | 프로젝트가 복사 후 크게 수정하면 디자인 시스템 기준에서 벗어날 수 있다. |

그래서 이 선택은 “Registry가 더 우월하다”는 결론이 아니다.

정확한 결론은 이렇다.

```text
장기 운영 제품에서 중앙 일관성이 중요하다
-> npm package 방식이 유리하다.

수명이 짧고 커스터마이징이 많은 micro SaaS가 많다
-> registry 방식이 유리하다.
```

우리는 두 번째 조건에 더 가까웠다.

## 6. Vite는 어디에 쓰는가

처음에는 Vite의 Library Mode도 같이 고민했다.

Vite Library Mode는 내가 만든 코드를 다른 프로젝트에서 `npm install`로 가져다 쓸 수 있도록 package 형태로 빌드하는 기능이다.

앱 빌드와 라이브러리 빌드는 목표가 다르다.

| 구분        | 일반 앱 빌드             | Library Mode                        |
| ----------- | ------------------------ | ----------------------------------- |
| 진입점      | `index.html`             | `src/index.ts`                      |
| 목표        | 브라우저에서 실행되는 앱 | 재사용 가능한 package               |
| 의존성 처리 | 앱 실행을 위해 묶음      | React 같은 peer dependency는 외부화 |
| 산출물      | 배포용 웹 파일           | ESM, type declaration, CSS 등       |

만약 `@dyna/design-system` 같은 package를 만들었다면 Vite Library Mode가 중요했을 것이다.

하지만 registry 방식에서는 핵심이 다르다. 컴포넌트를 하나의 package로 묶는 것보다, **컴포넌트 소스 파일을 올바른 위치에 복사하는 registry 정의**가 더 중요하다.

그래서 Vite의 역할도 바뀌었다.

```text
Vite의 역할
- registry 컴포넌트 개발용 playground
- 문서와 preview 사이트
- Button, TextField, Dialog 상태 검증
```

즉 Vite는 배포 package를 만들기 위한 중심 도구라기보다, registry 컴포넌트를 개발하고 확인하는 환경에 가깝다.

## 7. shadcn을 쓴다는 말의 의미를 좁혔다

여기서 중요한 오해가 하나 있었다.

“shadcn을 쓰자”는 말은 shadcn의 Tailwind 기반 컴포넌트를 그대로 가져오자는 뜻이 아니다.

우리 프로젝트는 Emotion을 사용한다. shadcn 기본 컴포넌트는 Tailwind class 중심인 경우가 많다. 그대로 가져오면 스타일 기준이 섞인다.

```text
Emotion 기반 프로젝트
+ Tailwind class 기반 컴포넌트
= 스타일 시스템이 두 개가 됨
```

그래서 나는 shadcn을 이렇게 해석하기로 했다.

```text
사용할 것
- registry 구조
- CLI 기반 코드 복사 흐름
- component/block 배포 모델

그대로 따르지 않을 것
- Tailwind 중심 스타일 구현
- shadcn 기본 컴포넌트의 시각 규칙
```

즉 shadcn은 디자인 언어가 아니라 **배포 모델**로 사용한다.

## 8. Radix UI는 접근성 primitive로 사용한다

Dialog, DropdownMenu, Tooltip 같은 컴포넌트는 단순히 div를 예쁘게 그리는 문제가 아니다.

Dialog 하나만 봐도 고려할 것이 많다.

- focus trap
- escape key close
- outside click dismiss
- `aria-modal`
- portal
- screen reader label

이런 상호작용을 직접 구현하면 실수할 가능성이 높다. 그래서 Radix UI를 primitive로 사용하기로 했다.

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
import styled from '@emotion/styled';

const DialogContent = styled(DialogPrimitive.Content)`
  background: var(--dyna-color-surface-floating);
  border-radius: var(--dyna-radius-medium);
`;
```

역할은 이렇게 나뉜다.

```text
Radix UI
= 접근성, keyboard interaction, focus management

Emotion
= Dyna 스타일 구현

CSS variables
= Figma token에서 온 시각 기준
```

이 구조는 registry 방식과도 잘 맞는다. 복사된 프로젝트는 컴포넌트 코드를 소유하지만, 복잡한 접근성 동작은 검증된 primitive에 기대게 된다.

## 9. Emotion은 유지하되 token은 CSS variable로 둔다

Emotion은 React 컴포넌트 스타일 구현에는 적합하다.

```tsx
const ButtonRoot = styled.button`
  background: var(--dyna-color-interactive-button-primary-enabled);
  color: var(--dyna-color-text-on-dark);
  border-radius: var(--dyna-radius-small);

  &:hover {
    background: var(--dyna-color-interactive-button-primary-hovered);
  }
`;
```

하지만 token 자체를 Emotion theme에만 넣고 싶지는 않았다.

token은 React보다 오래 살아야 한다. 지금은 React만 고려하지만, Vue 프로젝트도 존재한다. 그래서 색상, radius 같은 기준 값은 CSS variable로 제공하는 쪽이 더 낫다고 판단했다.

```css
:root {
  --dyna-color-surface-primary: #ffffff;
  --dyna-color-text-primary: #000000;
  --dyna-radius-none: 0px;
  --dyna-radius-small: 1px;
  --dyna-radius-medium: 2px;
  --dyna-radius-full: 999px;
}

[data-theme='dark'] {
  --dyna-color-surface-primary: #2c2c2c;
  --dyna-color-text-primary: #ffffff;
}
```

이렇게 하면 Emotion은 구현 도구가 되고, CSS variable은 팀 전체가 공유하는 token contract가 된다.

## 10. Figma와 코드는 같은 이름을 써야 한다

Figma를 보면서 코드화 전에 디자이너와 맞춰야 하는 지점도 보였다.

- `Frame` collection이 실제로 radius 값으로 쓰이고 있다면 `Radius`가 더 정확한 이름일 수 있다.
- `Text Field` component set이 2개라면 어느 쪽이 canonical인지 정해야 한다.
- `Text Filed`, `Vedio`, `Ckeckbox`, `LIght` 같은 naming 불일치는 코드로 옮기기 전에 정리하는 편이 좋다.
- Figma의 `State=Hovered/Focused`는 React prop으로 그대로 노출하기보다 CSS state로 매핑하는 편이 자연스럽다.

예를 들어 Figma에서는 Button이 이렇게 보일 수 있다.

```text
Color=Primary, Size=Large, State=Hovered
```

하지만 코드에서는 이렇게 쓰는 것이 더 낫다.

```tsx
<Button variant="primary" size="large">
  저장
</Button>
```

`Hovered`는 prop이 아니라 CSS pseudo-class로 처리한다.

```tsx
const ButtonRoot = styled.button`
  &:hover {
    background: var(--dyna-color-interactive-button-primary-hovered);
  }
`;
```

디자이너와 맞춘다는 것은 구현 허락을 받는다는 뜻이 아니다. Figma의 표현 모델과 코드의 구현 계약을 같은 의미로 해석하도록 합의하는 일이다.

이게 안 맞으면 문제는 “색이 조금 다름”이 아니다. 팀이 같은 컴포넌트를 다른 개념으로 이해하게 된다.

## 11. Storybook은 선택이 아니라 검증 도구에 가깝다

Storybook은 디자인 시스템 자체가 아니다. 컴포넌트를 앱 화면과 분리해서 개발, 문서화, 확인하는 도구다.

Registry 방식을 택하더라도 Storybook의 가치는 여전히 있다.

Button만 해도 확인해야 할 상태가 많다.

- primary
- secondary
- small
- medium
- large
- disabled
- leading icon
- trailing icon
- icon only

TextField도 마찬가지다.

- enabled
- focused
- disabled
- error
- leading icon
- trailing icon

micro SaaS에서는 개발 속도가 빠르기 때문에 오히려 이런 독립 검증 환경이 더 필요하다. 앱 화면 안에서만 컴포넌트를 확인하면, 상태 조합이 빠지기 쉽다.

## 12. 최종 구조

최종적으로는 이런 구조를 생각하고 있다.

```text
dyna-ui
├─ apps
│  └─ docs
│     └─ Vite React docs/playground
│
├─ src
│  ├─ components
│  │  ├─ button
│  │  ├─ icon-button
│  │  ├─ text-field
│  │  ├─ dialog
│  │  └─ dropdown-menu
│  │
│  ├─ blocks
│  │  ├─ login-page
│  │  ├─ dashboard-shell
│  │  ├─ timeline-editor
│  │  └─ script-panel
│  │
│  ├─ tokens
│  │  ├─ dyna-tokens.css
│  │  └─ tokens.ts
│  │
│  └─ lib
│
├─ registry
│  ├─ components
│  │  ├─ button.json
│  │  ├─ text-field.json
│  │  └─ dialog.json
│  │
│  └─ blocks
│     ├─ login-page.json
│     └─ timeline-editor.json
│
└─ public
   └─ r
      ├─ button.json
      ├─ text-field.json
      └─ timeline-editor.json
```

처음 만들 범위는 작게 잡는다.

```text
Foundation
- color token
- radius token

Component
- Icon
- Button
- IconButton
- TextField
- Divider

Radix 기반 Component
- Dialog
- DropdownMenu
- Tooltip
```

처음부터 모든 컴포넌트를 만들면 시스템이 아니라 목록이 된다. Button과 TextField를 먼저 만드는 이유는 variant, size, disabled, focus, error, icon slot, token binding을 모두 검증할 수 있기 때문이다.

## 13. 이번 판단의 결론

이 글의 결론은 “패키지 방식은 틀렸고 registry 방식이 맞다”가 아니다.

더 정확히는 다음과 같다.

> 디자인 시스템의 배포 방식은 조직의 제품 수명과 커스터마이징 방식에 맞아야 한다.

장기 운영되는 제품이 많고 중앙에서 UI 일관성을 강하게 유지해야 한다면 npm package가 더 적합할 수 있다.

하지만 Dyna처럼 micro SaaS 프로젝트가 많고, 각 프로젝트가 빠르게 변형되어야 한다면 registry 방식이 더 현실적이다.

우리는 중앙 통제력을 일부 포기한다. 대신 프로젝트별 소유권, 빠른 시작, 낮은 추상화 비용을 얻는다.

결국 디자인 시스템은 컴포넌트 파일을 모아둔 저장소가 아니다. 팀이 어떤 속도로 제품을 만들고, 어떤 책임 경계로 UI를 소유할지 결정하는 방식이다.

> 좋은 디자인 시스템은 모든 변화를 막는 규칙이 아니라, 각 프로젝트가 더 나은 출발점에서 자기 답을 찾게 만드는 기반이어야 한다.
