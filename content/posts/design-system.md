---
title: '[Part 1.] 디자인 시스템을 npm 패키지 대신 shadcn Registry로 배포한 이유'
description: 'micro SaaS 환경에서 디자인 시스템의 배포 방식을 결정한 기준과 shadcn Registry의 비용을 정리합니다.'
date: '2026-07-10'
tags: ['design-system', 'shadcn', 'frontend', 'architecture']
draft: false
---

여러 micro SaaS를 만들면서 같은 UI 결정을 반복했다. 이 문제를 줄이기 위해 디자인 시스템을 만들기로 했다.

가장 먼저 정한 것은 컴포넌트의 배포 방식이었다. 배포 방식에 따라 공통 구현과 설치된 소스 파일의 기본 유지보수 경로가 달라지기 때문이다.

우리에게는 npm 패키지보다 shadcn Registry가 더 맞았다. 중앙에서 같은 구현을 유지하는 것보다, 각 프로젝트가 검증된 코드를 빠르게 설치하고 직접 수정하는 일이 더 중요했기 때문이다.

이 글에서는 두 방식의 차이, Registry를 선택한 근거, 그 선택으로 생기는 비용을 설명한다. Registry가 npm 패키지보다 항상 낫다는 뜻은 아니다.

## [sort1] 1. 반복되는 UI 결정

디자인 시스템은 여러 제품에서 함께 사용하는 UI 기준이다. 색상과 간격 같은 **디자인 토큰(design token)**, Button과 Dialog 같은 컴포넌트, 접근성 규칙을 포함한다. [Figma는 디자인 시스템을 재사용 가능한 컴포넌트, 가이드라인, 도구의 모음](https://www.figma.com/resource-library/design-system-examples/)으로 설명한다.

제품이 늘어나면서 다음 결정을 반복했다.

- Button의 `disabled` 상태에서 hover와 cursor를 어떻게 처리할지
- TextField의 `error`, `focused`, `disabled` 상태를 어떤 이름으로 표현할지
- Figma의 variant 이름과 코드의 prop 이름을 어떻게 맞출지

기준이 다르면 개발자는 UI를 만들기 전에 기준 구현부터 찾아야 한다. 그래서 다음 프로젝트가 같은 문제를 다시 풀지 않도록 공통 출발점을 만들기로 했다.

모든 제품을 똑같이 만드는 것은 목표가 아니었다. 제품에 맞게 UI를 바꿀 수 있어야 했다.

> 우리의 목표는 모든 UI를 통제하는 것이 아니라, 검증된 기본값에서 빠르게 시작하는 것이었다.

## [sort1] 2. 컴포넌트의 유지보수 책임

배포 방식을 정하려면 먼저 컴포넌트 구현의 **유지보수 책임**을 정해야 한다. 여기서 유지보수 책임은 구현을 직접 수정하고, 변경 사항을 검증하며, 이후 업데이트를 반영할 책임을 뜻한다.

처음에는 디자인 시스템을 npm 패키지로 만들려고 했다.

```tsx
import { Button } from '@editor/design-system';

export function SaveButton() {
  return <Button variant="primary">저장</Button>;
}
```

npm 패키지를 사용하면 디자인 시스템 팀이 공통 구현을 관리한다. 각 프로젝트는 패키지가 공개한 API를 사용하고 의존성 버전과 통합 코드를 관리한다.

Registry를 사용하면 소스 파일이 프로젝트 저장소에 추가된다. Registry 팀은 설치할 원본을 관리하고, 각 프로젝트는 설치된 소스 파일을 직접 관리한다.

이 차이는 버전 관리, 프로젝트별 수정, 변경 전파 방법을 결정한다. 그래서 디자인 토큰이나 컴포넌트 목록보다 배포 방식을 먼저 검토했다.

## [sort1] 3. 두 배포 방식 비교

**npm 패키지 방식**은 UI 컴포넌트를 패키지로 배포하고, 각 프로젝트가 의존성으로 설치해 `import`하는 방식이다.

[shadcn Registry](https://ui.shadcn.com/docs/registry)는 CLI로 컴포넌트와 설정 파일을 프로젝트에 설치하는 코드 배포 방식이다.

```bash
pnpm dlx shadcn@latest add https://editor-ui.internal/r/button.json
```

설치가 끝나면 Button 소스 파일이 프로젝트 안에 생긴다.

```text
src/components/ui/button.tsx
src/styles/editor-tokens.css
```

| 기준            | npm 패키지                                                                        | shadcn Registry                                               |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 설치 결과       | `node_modules`의 패키지를 참조한다.                                               | 프로젝트 저장소에 소스 파일을 추가한다.                       |
| 유지보수 책임   | 디자인 시스템 팀은 공통 구현을, 각 프로젝트는 의존성 버전과 통합 코드를 관리한다. | Registry 팀은 원본을, 각 프로젝트는 설치한 구현을 관리한다.   |
| 프로젝트별 수정 | 공개 API나 확장 지점이 필요하다.                                                  | 소스 파일을 직접 수정할 수 있다.                              |
| 변경 반영       | 프로젝트가 패키지 버전을 올려 변경을 받는다.                                      | 원본 변경을 수동으로 반영하거나 별도 마이그레이션이 필요하다. |
| 구현 일관성     | 여러 프로젝트가 같은 패키지 구현을 참조한다.                                      | 프로젝트별 수정으로 구현이 달라질 수 있다.                    |

두 방식은 목적이 다르다.

- 장기 운영 제품에 같은 변경을 계속 적용해야 한다면 npm 패키지가 더 적합할 수 있다.
- 빠르게 시작한 뒤 제품별로 수정해야 한다면 Registry가 더 적합할 수 있다.

## [sort1] 4. Registry 선택 근거

우리가 확인한 운영 조건은 다음과 같았다.

- 빠르게 만들고 검증하는 micro SaaS가 많았다.
- 프로젝트마다 UI를 수정할 요구가 자주 생겼다.
- 모든 프로젝트가 같은 컴포넌트 구현을 계속 공유할 필요는 없었다.

npm 패키지에 프로젝트별 요구를 모두 넣으면 공통 API가 복잡해질 수 있다.

```tsx
<Button variant="primary" loadingPlacement="left" trackingEvent="project_create_click" projectSpecificRadius="compact">
  생성하기
</Button>
```

이런 prop이 항상 잘못된 것은 아니다. 여러 제품에서 반복해서 필요하다면 공통 API로 관리할 수 있다. 한 제품에만 필요한 prop이 계속 쌓이면 공통 컴포넌트가 제품별 정책까지 맡게 된다.

Registry에서는 기본 구현을 설치한 뒤 각 프로젝트가 직접 수정할 수 있다. 공통 API에 모든 예외를 추가하지 않아도 된다.

이 운영 조건을 근거로 Registry를 선택했다. micro SaaS라는 사실만으로 Registry가 필요하거나 충분한 것은 아니다. 제품 수명, 변경 전파 범위, 프로젝트별 수정 빈도를 함께 봐야 한다.

## [sort1] 5. shadcn 적용 범위

shadcn/ui의 디자인과 Tailwind 구현을 그대로 사용하지 않는다. **Registry와 CLI를 이용한 소스 코드 배포 방식만 사용한다.**

기존 Electron 프로젝트는 Emotion을 사용하고 있었다. Tailwind를 추가하면 스타일 작성과 디버깅 방법이 두 개가 된다. 그래서 기존 스타일 도구를 유지하고 역할을 다음처럼 나눴다.

| 도구            | 역할                                                        |
| --------------- | ----------------------------------------------------------- |
| shadcn Registry | 컴포넌트 소스 파일과 의존성 배포                            |
| Radix UI        | Dialog, DropdownMenu, Tooltip의 접근성 구조와 상호작용 구현 |
| Emotion         | React 컴포넌트 스타일 작성                                  |
| CSS 변수        | 여러 프레임워크가 공유할 디자인 토큰 제공                   |

[Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/accessibility)는 `aria`와 `role` 속성, 초점 관리, 키보드 이동 같은 접근성 구현을 제공한다. Radix UI를 사용해도 접근성이 자동으로 완성되지는 않는다. 각 프로젝트는 컴포넌트를 수정한 뒤 접근 가능한 이름, 키보드 조작, 초점 이동을 다시 검증해야 한다.

CSS 변수는 Emotion과 디자인 토큰을 분리한다.

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

Emotion은 React 컴포넌트의 스타일을 작성한다. CSS 변수는 React와 Vue에서 같은 이름으로 참조할 수 있다. 두 프레임워크에서 같은 토큰이 실제로 동작하는지는 구현 과정에서 검증해야 한다.

## [sort1] 6. Registry의 비용과 대응

Registry는 프로젝트별 수정을 쉽게 만든다. 대신 중앙에서 변경을 전파하기는 어려워진다.

| 비용                                                    | 필요한 대응                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| 원본 수정이 설치된 프로젝트에 자동으로 반영되지 않는다. | 변경 내용과 마이그레이션 방법을 제공해야 한다.                    |
| 같은 이름의 컴포넌트가 프로젝트마다 달라질 수 있다.     | 공통 API로 되돌릴 변경과 프로젝트에 남길 변경을 구분해야 한다.    |
| 프로젝트가 접근성 동작을 깨뜨릴 수 있다.                | 수정한 컴포넌트의 키보드 조작과 초점 이동을 다시 테스트해야 한다. |
| 설치한 원본 버전을 찾기 어려울 수 있다.                 | 설치 버전이나 변경 이력을 추적할 방법을 정해야 한다.              |

이 대응 방법은 Registry를 선택했다고 자동으로 생기지 않는다. 도입 전에 팀이 운영 기준과 검증 절차를 정해야 한다.

초기에는 Button과 TextField부터 검증한다. 두 컴포넌트로 variant, size, disabled, focus, error, icon, 디자인 토큰 연결을 함께 확인할 수 있기 때문이다.

[Storybook](https://storybook.js.org/docs)은 Registry 원본의 상태별 예제를 실행하고 테스트하는 데 사용한다. 각 프로젝트는 설치 후 수정한 코드도 별도로 테스트해야 한다.

## [sort1] 7. 재검토 조건

Registry는 현재 운영 조건에 맞춘 설계 판단이다. 다음 조건이 생기면 npm 패키지를 다시 검토한다.

- 여러 장기 운영 제품이 같은 구현을 유지해야 할 때
- 보안이나 접근성 수정 사항을 여러 제품에 빠르게 전파해야 할 때
- 프로젝트별 수정 가능성보다 공통 API의 안정성이 중요해질 때
- 설치된 코드의 차이를 추적하는 비용이 커질 때

프로젝트별 실험과 수정이 계속 중요하다면 Registry 방식의 장점이 유지된다.

## [sort1] 8. 배포 방식이 정하는 운영 책임

처음에는 디자인 시스템을 만들면 npm 패키지부터 배포해야 한다고 생각했다. 하지만 우리에게 더 중요한 기준은 설치한 컴포넌트의 유지보수 책임이었다.

우리는 중앙에서 변경을 전파하기 쉬운 구조보다, 각 프로젝트가 검증된 코드를 빠르게 설치하고 직접 수정하는 구조를 선택했다.

> 디자인 시스템의 배포 방식은 파일을 전달하는 방법만 정하지 않는다. 설치한 코드를 누가 유지할지도 정한다.

## 참고 자료

- [Figma가 설명하는 디자인 시스템의 기본 개념](https://www.figma.com/resource-library/design-system-examples/)
- [Figma가 설명하는 디자인 토큰의 역할](https://www.figma.com/resource-library/design-tokens/)
- [npm 공식 문서의 package와 module 개념](https://docs.npmjs.com/about-packages-and-modules/)
- [shadcn/ui Registry의 구조와 역할](https://ui.shadcn.com/docs/registry)
- [shadcn/ui Registry 시작 방법](https://ui.shadcn.com/docs/registry/getting-started)
- [Radix Primitives의 접근성 원칙](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Storybook 공식 문서](https://storybook.js.org/docs)
