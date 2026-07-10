---
title: '[Part 1.] 디자인 시스템을 npm 패키지 대신 shadcn Registry로 배포한 이유'
description: 'micro SaaS 환경에서 디자인 시스템을 npm 패키지가 아닌 shadcn Registry로 설계한 이유와 Radix UI, Emotion, CSS 변수 기반 구현 전략을 정리합니다.'
date: '2026-07-10'
tags: ['design-system', 'shadcn', 'frontend', 'architecture']
draft: false
---

디자인 시스템을 만든다고 하면 자연스럽게 `@company/design-system` 같은 npm 패키지를 떠올리게 된다.

나도 처음에는 Button, TextField, Dialog 같은 컴포넌트를 하나의 패키지로 묶고 각 프로젝트에서 import하는 구조가 가장 정석에 가깝다고 생각했다.

```tsx
import { Button } from '@dyna/design-system';

export function SaveButton() {
  return <Button variant="primary">저장</Button>;
}
```

그러나 Dyna의 제품 환경을 기준으로 다시 검토하자 다른 결론에 도달했다. 우리는 빠르게 만들고 배포하며, 검증 결과에 따라 운영을 종료하기도 하는 micro SaaS 프로젝트가 많다. 이런 환경에서는 모든 컴포넌트를 중앙에서 장기간 통제하는 방식보다, 검증된 초기 구현을 제공하고 각 프로젝트가 맥락에 맞게 수정하는 구조가 더 적합할 수 있었다.

이번 글에서는 디자인 시스템을 **npm 라이브러리 패키지**가 아닌 **shadcn-style Registry**로 배포하기로 한 판단 과정과 구현 경계를 정리한다.

## 1. 왜 배포 방식부터 결정했는가

디자인 시스템을 만든다는 말에는 여러 문제가 섞여 있다.

- 어떤 디자인 토큰(design token)을 만들 것인가
- Button의 공개 API는 어떻게 정할 것인가
- Figma와 코드의 이름을 어떻게 맞출 것인가
- Storybook을 사용할 것인가
- React와 Vue를 모두 지원할 것인가
- npm 패키지로 배포할 것인가, 소스 코드를 프로젝트에 설치할 것인가

이 가운데 가장 먼저 정해야 했던 것은 **배포 방식**이었다.

배포 방식에 따라 설치된 컴포넌트의 소유권이 달라진다. 소유권이 정해져야 버전 관리(versioning), 프로젝트별 수정, 마이그레이션 전략도 정할 수 있다.

검토한 선택지는 크게 두 가지였다.

```text
1. npm 라이브러리 패키지를 설치하고 참조하는 방식
2. Registry에서 소스 코드를 받아 프로젝트에 설치하는 방식
```

## 2. 왜 npm 패키지 방식이 매력적으로 보였는가

npm 패키지 방식은 익숙하다. 디자인 시스템을 하나의 패키지로 배포하고 각 프로젝트가 의존성으로 설치한다.

```bash
pnpm add @dyna/design-system
```

```tsx
import { Button, TextField } from '@dyna/design-system';
```

장점은 명확하다.

| 기준          | npm 패키지 방식의 장점                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| 버전 관리     | `@dyna/design-system@1.2.0`처럼 소비 중인 버전을 식별할 수 있다.              |
| 업데이트 경로 | 수정 버전을 배포하고 각 앱이 의존성 버전을 올리는 일관된 경로를 만들 수 있다. |
| 구현 일관성   | 여러 앱이 같은 패키지 구현을 참조하므로 코드가 프로젝트마다 갈라지기 어렵다.  |
| API 관리      | 디자인 시스템 팀이 컴포넌트의 공개 API와 변경 정책을 중앙에서 관리하기 좋다.  |

장기간 운영하는 제품이 많고 여러 팀이 같은 UI 규칙을 유지해야 한다면 npm 패키지 방식은 강한 선택지다.

하지만 Dyna의 micro SaaS 환경에서는 이 장점이 운영 비용으로 바뀔 수 있었다.

## 3. 왜 micro SaaS에서는 패키지의 비용이 커졌는가

우리에게는 “모든 앱이 같은 Button 구현을 계속 공유한다”는 목표보다 “쓸 만한 Button으로 빠르게 시작하고, 제품 맥락에 맞게 바로 고친다”는 목표가 더 중요했다.

예를 들어 한 프로젝트에서는 Button 클릭에 분석 이벤트가 필요하고, 다른 프로젝트에서는 로딩 아이콘의 위치가 달라야 하며, 또 다른 프로젝트에서는 특정 화면의 모서리 반경만 달라야 한다고 해보자.

공통 패키지에서 모든 요구를 수용하면 프로젝트별 예외가 공개 prop으로 올라오기 쉽다.

```tsx
<Button variant="primary" loadingPlacement="left" trackingEvent="project_create_click" projectSpecificRadius="compact">
  생성하기
</Button>
```

이 API가 항상 잘못된 것은 아니다. 다만 각 옵션이 여러 제품에서 반복해서 필요한지 검증하지 않은 채 추가되면, 공통 컴포넌트가 프로젝트별 정책까지 떠안는다. 그 결과 Button은 재사용 가능한 UI 계약이 아니라 예외를 누적한 추상화가 될 수 있다.

여기서 얻은 첫 번째 기준은 단순했다.

> 중앙에서 장기간 관리할 컴포넌트와 프로젝트가 빠르게 소유해야 하는 컴포넌트는 배포 방식이 달라야 한다.

## 4. shadcn Registry는 무엇이 다른가

npm 패키지 방식에서는 컴포넌트 구현이 일반적으로 `node_modules` 안에 있고, 앱은 패키지가 공개한 API를 참조한다.

```text
node_modules/@dyna/design-system/button
```

반면 shadcn Registry에서는 CLI가 Registry item에 정의된 소스 파일과 의존성을 대상 프로젝트에 설치한다.

```bash
pnpm dlx shadcn@latest add https://dyna-ui.internal/r/button.json
```

설치 후 컴포넌트는 앱 저장소 안의 파일이 된다.

```text
src/components/ui/button.tsx
src/styles/dyna-tokens.css
```

정확히 말하면 **소스 코드 배포(source-code distribution)**가 상위 개념이고, **shadcn Registry를 통한 코드 설치**가 이번에 선택한 구체적인 메커니즘이다.

두 방식의 핵심 차이는 설치 이후의 소유권이다.

```text
npm 패키지
-> 패키지 저장소가 구현을 소유하고, 앱은 공개 API에 의존한다.

shadcn Registry
-> 앱 저장소가 설치된 구현을 소유하고, 필요하면 직접 수정한다.
```

## 5. Registry 방식으로 무엇을 얻고 무엇을 포기하는가

Registry 방식이 우리 환경에 제공하는 이점은 직접적이었다.

| 기준            | Registry 방식의 이점                                                   |
| --------------- | ---------------------------------------------------------------------- |
| 빠른 수정       | 컴포넌트 코드가 앱 안에 있으므로 제품 요구에 맞게 바로 수정할 수 있다. |
| 선택적 설치     | 필요한 컴포넌트나 block만 프로젝트에 설치할 수 있다.                   |
| 구현 가시성     | 앱에서 실제로 실행되는 구현과 의존성을 직접 확인할 수 있다.            |
| 프로젝트 적응성 | 폴더 구조, import alias, 스타일 규칙에 맞게 코드를 변경하기 쉽다.      |

대신 다음 비용을 받아들여야 한다.

| 기준              | Registry 방식의 비용                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| 중앙 업데이트     | Registry 원본을 수정해도 이미 설치된 프로젝트의 코드가 자동으로 바뀌지 않는다.     |
| 구현 일관성       | 프로젝트별 수정이 누적되면 같은 이름의 컴포넌트가 서로 다르게 동작할 수 있다.      |
| 마이그레이션 추적 | 별도 메타데이터나 자동화가 없으면 어떤 원본 버전에서 갈라졌는지 추적하기 어렵다.   |
| 품질 기준 유지    | 프로젝트가 코드를 수정한 뒤에도 접근성·디자인 토큰·테스트 기준을 직접 지켜야 한다. |

따라서 결론은 “Registry가 npm 패키지보다 우월하다”가 아니다.

```text
장기 운영 제품이 많고 중앙 일관성이 중요하다
-> npm 패키지 방식이 더 적합할 수 있다.

수명이 짧고 프로젝트별 수정 요구가 많은 제품이 많다
-> Registry 방식이 더 적합할 수 있다.
```

Dyna는 두 번째 조건에 더 가까웠다. 이것이 Registry를 선택한 필요조건은 아니지만, 선택의 주요 근거였다.

## 6. Registry를 선택하면 Vite의 역할은 어떻게 달라지는가

초기에는 Vite의 Library Mode도 함께 검토했다.

Vite Library Mode는 브라우저 지향 라이브러리를 배포 가능한 JavaScript 번들로 만들 때 사용하는 빌드 설정이다. 일반 앱 빌드와 라이브러리 빌드는 목표가 다르다.

| 구분        | 일반 앱 빌드                     | Library Mode                                         |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| 대표 진입점 | `index.html`                     | `src/index.ts` 같은 라이브러리 진입 모듈             |
| 목표        | 브라우저에서 실행할 앱 배포      | 다른 프로젝트가 소비할 라이브러리 번들 배포          |
| 의존성 처리 | 앱 실행에 필요한 코드를 묶음     | React 같은 의존성을 외부화하도록 별도 설정할 수 있음 |
| 대표 산출물 | HTML, JavaScript, CSS, 정적 파일 | ESM·CJS 등의 JavaScript 번들과 추출된 CSS            |

TypeScript 선언 파일은 Library Mode 자체가 자동으로 보장하는 산출물이 아니다. 패키지로 배포하려면 TypeScript 설정이나 별도 플러그인으로 선언 파일 생성 과정을 구성해야 한다.

`@dyna/design-system` 패키지를 만들었다면 Library Mode가 배포 파이프라인의 중심이 되었을 것이다. 그러나 Registry 방식에서는 컴포넌트를 하나의 번들로 묶는 것보다 소스 파일, 의존성, 설치 경로를 Registry item에 정확히 정의하는 일이 더 중요하다.

그래서 Vite의 책임을 다음과 같이 좁혔다.

```text
Vite의 역할
- Registry 컴포넌트 개발용 playground 실행
- 문서와 preview 사이트 빌드
- Button, TextField, Dialog의 상태를 브라우저에서 확인
```

Vite는 npm 패키지를 만드는 중심 도구가 아니라 Registry 컴포넌트를 개발하고 검증하는 실행 환경이 된다.

## 7. shadcn을 사용한다는 말의 범위를 어떻게 정했는가

“shadcn을 사용한다”는 말은 shadcn/ui의 시각 디자인과 Tailwind 기반 구현을 그대로 가져온다는 뜻으로 오해하기 쉽다.

하지만 Dyna 프로젝트는 Emotion을 사용한다. Tailwind class 중심의 컴포넌트를 그대로 섞으면 한 컴포넌트 계층에서 두 스타일링 체계를 함께 운영하게 된다.

```text
Emotion 기반 프로젝트
+ Tailwind class 기반 컴포넌트
= 스타일 작성·검토·디버깅 경로가 둘로 나뉨
```

그래서 shadcn의 적용 범위를 명확히 나눴다.

```text
사용할 것
- Registry schema와 배포 구조
- CLI 기반 소스 코드 설치 흐름
- component와 block 단위의 배포 모델

그대로 따르지 않을 것
- Tailwind 중심의 스타일 구현
- shadcn/ui 기본 컴포넌트의 시각 규칙
```

즉 shadcn은 Dyna의 디자인 언어가 아니라 **소스 코드 배포 메커니즘**으로 사용한다.

## 8. 왜 Radix UI를 접근성 Primitive로 사용하는가

Dialog, DropdownMenu, Tooltip 같은 컴포넌트는 `div`를 시각적으로 꾸미는 것만으로 완성되지 않는다.

Dialog를 구현하려면 다음 동작과 의미 구조를 함께 고려해야 한다.

- 초점 이동과 modal focus 관리
- Escape 키 입력 처리
- modal 외부 상호작용 처리
- 접근 가능한 이름과 설명
- portal 렌더링
- 키보드 탐색

이 동작을 모든 프로젝트에서 직접 구현하면 누락 가능성이 커진다. 그래서 WAI-ARIA 패턴, 초점 관리, 키보드 탐색을 제공하는 Radix UI를 낮은 수준의 UI Primitive로 사용하기로 했다.

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
import styled from '@emotion/styled';

const DialogContent = styled(DialogPrimitive.Content)`
  background: var(--dyna-color-surface-floating);
  border-radius: var(--dyna-radius-medium);
`;
```

각 도구의 책임은 다음과 같이 나뉜다.

```text
Radix UI
= 접근성 의미 구조, 키보드 상호작용, 초점 관리

Emotion
= Dyna 컴포넌트 스타일 구현

CSS 변수
= Figma 디자인 토큰과 연결되는 값의 계약
```

이 구조는 Registry 방식과도 맞는다. 프로젝트는 설치된 컴포넌트 코드를 소유하고, 복잡한 접근성 동작은 Radix UI Primitive의 계약에 의존한다.

다만 Radix UI를 사용한다는 사실만으로 완성된 접근성이 보장되지는 않는다. Dialog의 제목과 설명을 제공하고, 설치 후 수정한 상호작용을 다시 검증하는 책임은 여전히 프로젝트에 있다.

## 9. 왜 Emotion은 유지하고 디자인 토큰은 CSS 변수로 두는가

Emotion은 React 컴포넌트의 스타일 구현에 사용한다.

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

하지만 디자인 토큰 자체를 Emotion theme에만 넣지는 않기로 했다.

디자인 토큰은 특정 React 구현보다 오래 유지될 수 있어야 한다. 현재는 React를 우선 지원하지만 Vue 프로젝트도 존재하기 때문에 색상과 모서리 반경 같은 기준 값은 CSS 변수로 제공하는 편이 이식성에 유리하다고 판단했다.

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

이렇게 나누면 Emotion은 React 컴포넌트의 구현 도구가 되고, CSS 변수 이름과 값은 여러 프레임워크가 공유할 수 있는 디자인 토큰 계약이 된다.

## 10. Figma와 코드의 이름을 왜 맞춰야 하는가

코드 구현 전에 Figma의 표현 모델과 코드의 공개 API가 같은 의미를 가리키는지 확인해야 했다.

현재 디자인 파일을 검토하며 다음 정리 항목을 찾았다.

- 모서리 반경 값을 담은 `Frame` collection은 `Radius`가 더 정확한 이름인지 확인한다.
- `Text Field` component set이 두 개라면 어느 쪽이 기준(canonical)인지 정한다.
- `Text Filed`, `Vedio`, `Ckeckbox`, `LIght` 같은 표기 불일치를 코드화 전에 정리한다.
- Figma의 `State=Hovered/Focused`를 React prop으로 노출할지 CSS 상태로 매핑할지 구분한다.

예를 들어 Figma에서는 Button variant가 다음과 같이 표현될 수 있다.

```text
Color=Primary, Size=Large, State=Hovered
```

그러나 코드에서는 사용자가 제어하는 variant와 브라우저 상호작용 상태를 분리하는 편이 자연스럽다.

```tsx
<Button variant="primary" size="large">
  저장
</Button>
```

`Hovered`는 React prop이 아니라 CSS pseudo-class로 처리한다.

```tsx
const ButtonRoot = styled.button`
  &:hover {
    background: var(--dyna-color-interactive-button-primary-hovered);
  }
`;
```

디자이너와의 합의는 구현 허락을 받는 절차가 아니다. Figma의 variant, state, token과 코드의 prop, CSS state, CSS 변수가 같은 개념을 표현하도록 계약을 맞추는 일이다.

이 계약이 어긋나면 단순한 색상 차이를 넘어 팀이 같은 컴포넌트를 서로 다른 상태 모델로 이해하게 된다.

## 11. Storybook을 어떤 검증 도구로 사용할 것인가

Storybook은 디자인 시스템 자체가 아니다. 앱 화면과 분리된 환경에서 UI 컴포넌트의 상태를 개발하고 문서화하며 테스트할 수 있게 돕는 도구다.

Registry 방식을 선택해도 독립 검증 환경은 필요하다. Button만 해도 다음 상태 조합을 확인해야 한다.

- primary와 secondary
- small, medium, large
- disabled
- leading icon과 trailing icon
- icon only

TextField도 마찬가지다.

- enabled
- focused
- disabled
- error
- leading icon과 trailing icon

빠르게 변하는 micro SaaS에서는 앱 화면 안에서 확인한 상태만 구현하고 나머지 조합을 놓치기 쉽다. Story를 상태별 실행 예제로 두면 시각 검토뿐 아니라 상호작용 테스트와 접근성 테스트의 입력으로도 활용할 수 있다.

따라서 Storybook은 Registry의 배포 책임을 대신하지 않는다. 설치하기 전 원본 컴포넌트의 상태 조합을 반복해서 검증하는 경로를 제공한다.

## 12. 최종 구조를 어떻게 설계했는가

최종적으로 다음 구조를 계획했다.

```text
dyna-ui
├─ registry.json
│
├─ apps
│  └─ docs
│     └─ Vite React docs/playground
│
├─ registry
│  ├─ components
│  │  ├─ button.tsx
│  │  ├─ text-field.tsx
│  │  └─ dialog.tsx
│  └─ blocks
│     ├─ login-page.tsx
│     └─ timeline-editor.tsx
│
├─ styles
│  └─ dyna-tokens.css
│
└─ public
   └─ r
      ├─ registry.json
      ├─ button.json
      ├─ text-field.json
      └─ timeline-editor.json
```

여기서 `registry.json`은 Registry item 목록과 파일 관계를 정의하는 원본이고, `public/r` 아래 JSON은 배포 과정에서 생성해 HTTP로 제공할 결과물이다.

첫 구현 범위는 작게 잡았다.

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

Radix UI 기반 Component
- Dialog
- DropdownMenu
- Tooltip
```

처음부터 모든 컴포넌트를 만들면 시스템을 검증하기 전에 목록만 커질 수 있다. Button과 TextField를 먼저 만드는 이유는 variant, size, disabled, focus, error, icon slot, 디자인 토큰 연결을 작은 범위에서 함께 검증할 수 있기 때문이다.

## 13. npm 패키지 대신 Registry를 선택하며 배운 것

이 글의 결론은 “npm 패키지는 틀렸고 shadcn Registry가 맞다”가 아니다.

> 디자인 시스템의 배포 방식은 조직이 운영하는 제품의 수명과 커스터마이징 방식에 맞아야 한다.

장기 운영 제품이 많고 중앙에서 UI 일관성과 마이그레이션을 관리해야 한다면 npm 패키지가 더 적합할 수 있다.

반면 Dyna처럼 micro SaaS 프로젝트가 많고 각 프로젝트가 빠르게 변형되어야 한다면 Registry가 더 현실적인 선택일 수 있다.

우리는 중앙 통제력과 자동 업데이트 경로 일부를 포기한다. 대신 프로젝트별 코드 소유권, 빠른 초기 도입, 제품 맥락에 맞춘 수정 가능성을 얻는다. 이것은 측정된 생산성 향상이 아니라, 현재 제품 운영 방식에 근거한 설계상의 기대효과다. 실제 효과는 설치 시간, 프로젝트별 수정량, 원본과의 편차, 마이그레이션 비용을 운영 과정에서 측정해야 판단할 수 있다.

결국 디자인 시스템은 컴포넌트 파일을 모아 둔 저장소가 아니다. 팀이 어떤 속도로 제품을 만들고 어떤 책임 경계로 UI를 소유할지 정하는 운영 모델에 가깝다.

> 좋은 디자인 시스템은 모든 변화를 막는 규칙이 아니라, 각 프로젝트가 검증된 출발점에서 자기 답을 찾게 만드는 기반이어야 한다.

## 참고 자료

- [shadcn/ui Registry 소개](https://ui.shadcn.com/docs/registry)
- [shadcn/ui Registry 시작하기](https://ui.shadcn.com/docs/registry/getting-started)
- [Vite Library Mode](https://vite.dev/guide/build.html#library-mode)
- [Radix Primitives 접근성](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Storybook UI 테스트](https://storybook.js.org/docs/writing-tests)
