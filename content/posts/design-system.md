---
title: '[Part 1.] 디자인 시스템을 npm 패키지 대신 shadcn Registry로 배포한 이유'
description: 'micro SaaS 환경에서 디자인 시스템을 npm 패키지가 아닌 shadcn Registry로 설계한 이유와 Radix UI, Emotion, CSS 변수 기반 구현 전략을 정리합니다.'
date: '2026-07-10'
tags: ['design-system', 'shadcn', 'frontend', 'architecture']
draft: false
---

## [sort1] 1. 디자인 시스템이란 무엇인가?

디자인 시스템은 여러 제품 화면에서 반복되는 UI 결정과 구현 기준을 함께 관리하는 체계다. 여기서 UI 결정은 색상, 간격, typography, radius 같은 기준 값, Button과 Dialog 같은 component, 접근성 기준, 문서화 방식, 배포 정책을 모두 포함한다. [Figma는 디자인 시스템을 재사용 가능한 component, guideline, tool의 집합](https://www.figma.com/resource-library/design-system-examples/)으로 설명한다. 일반적으로 디자인 시스템은 다음 흐름으로 만든다.

1. 여러 화면에서 반복되는 UI와 불일치를 수집한다.
2. 색상, 간격, typography, radius 같은 foundation 값을 정의한다.
3. Button, TextField, Dialog 같은 핵심 component의 상태와 공개 API를 정한다.
4. Figma component와 코드 component가 같은 이름과 상태 모델을 쓰도록 맞춘다.
5. 독립 UI 개발 환경에서 상태별 예제를 만들고, 시각 회귀 테스트 도구로 변경을 검토한다.
6. 마지막으로 패키지로 공유할지, 소스 코드를 설치할지 배포 모델을 정한다.

다만 실무의 순서가 항상 선형으로 흐르지는 않는다. 특히 배포 모델은 component의 소유권, versioning, migration 비용을 먼저 결정한다. 그래서 이 글은 디자인 시스템의 모든 제작 과정보다 **배포 모델을 먼저 정해야 했던 이유** 에 집중한다.

## [sort1] 2. 왜 우리 회사에 디자인 시스템이 필요했는가

우리 회사에서 디자인 시스템이 필요했던 이유는 “예쁜 공통 UI를 만들기 위해서”가 아니었다. 직접적인 배경은 **제품 수가 늘어나면서 같은 UI 결정을 반복해서 다시 내리게 된 것** 이었다. 우리는 하나의 장기 운영 SaaS만 만드는 환경이 아니었다. Electron 기반 멀티미디어 편집기 데스크톱 앱을 중심으로, 빠르게 만들고 검증하는 micro SaaS 제품군이 함께 존재했다. 제품마다 화면 맥락은 달랐지만 Button, IconButton, TextField, Dialog, DropdownMenu, Tooltip 같은 기본 UI는 계속 반복되었다. 문제는 반복 자체가 아니라, 반복될 때마다 기준이 조금씩 달라지는 구조가 생겼다는 점이다. 대표적으로 `disabled` 상태를 색상만 바꾸는 상태로 볼지, cursor와 hover 동작까지 함께 막는 상태로 볼지 화면마다 해석이 달라질 수 있었다. TextField의 `error`, `focused`, `disabled` 상태도 제품마다 시각 규칙과 prop 이름이 달라지기 쉬웠다. 이런 차이는 초기에는 작은 구현 차이처럼 보이지만, 제품이 늘어나면 “이번에는 어떤 Button을 기준으로 삼아야 하는가”를 매번 다시 확인해야 하는 비용으로 바뀐다.

디자인 파일과 코드 사이의 이름도 같은 문제를 만들었다. 예를 들어 Figma 안에서 같은 역할의 component set이 두 개 있거나, variant 이름과 코드 prop 이름이 다르면 개발자는 구현 전에 기준이 되는 모델부터 확인해야 한다. 이 상태에서는 UI 구현 시간이 컴포넌트를 만드는 시간만이 아니라, “어느 이름이 맞는가”, “어느 상태가 기준인가”, “이 예외를 공통화해야 하는가”를 결정하는 시간까지 포함하게 된다. 관련 글들을 보면 디자인 시스템의 필요성은 보통 일관성과 속도로 설명된다. [Figma의 디자인 시스템 글](https://www.figma.com/blog/design-systems-101-what-is-a-design-system/)은 반복 요소와 기준을 공유하면 제품을 규모 있게 만들 때 재작업을 줄일 수 있다고 설명하고, [Shopify Polaris 사례](https://www.shopify.com/partners/blog/design-system)는 앱이 기능을 확장할수록 일관된 사용자 경험을 유지하는 문제를 다룬다. 이 관점은 우리 상황과도 맞았다. 우리에게 필요한 것은 새로운 UI를 매번 처음부터 설계하지 않게 만드는 출발점이었다.

다만 여기서 말하는 일관성은 모든 제품을 똑같이 보이게 만드는 강제 규칙이 아니다. micro SaaS는 제품별 실험 속도가 중요하다. 그래서 중앙에서 모든 변형을 통제하는 시스템보다, 각 프로젝트가 검증된 기본값에서 시작하고 필요한 만큼 수정할 수 있는 체계가 더 현실적이었다. [Spotify Engineering의 디자인 시스템 글](https://engineering.atspotify.com/2023/05/multiple-layers-of-abstraction-in-design-systems)이 말하는 customization과 configuration의 긴장처럼, 우리도 자유로운 수정 가능성과 공통 기준 사이에서 균형을 잡아야 했다. 그래서 우리의 1차 목표는 다음 프로젝트가 같은 문제를 다시 풀지 않아도 되는 기준을 만드는 것이었다. [Adobe의 디자인 시스템 글](https://blog.adobe.com/en/publish/2021/05/26/best-practices-to-scale-design-with-design-systems)이 디자인 시스템을 확장 가능한 제품 제작 기반으로 설명하듯, 우리에게도 필요한 것은 개별 화면의 빠른 구현을 넘어 다음 제품까지 이어지는 UI 기준이었다. 디자인 시스템을 만든다고 하면 자연스럽게 `@company/design-system` 같은 npm 패키지를 떠올리게 된다.

나도 처음에는 Button, TextField, Dialog 같은 컴포넌트를 하나의 패키지로 묶고 각 프로젝트에서 import하는 구조가 가장 정석에 가깝다고 생각했다.

```tsx
import { Button } from '@editor/design-system';

export function SaveButton() {
  return <Button variant="primary">저장</Button>;
}
```

그러나 Electron 기반 멀티미디어 편집기 데스크톱 앱과 그 주변 micro SaaS 제품군의 환경을 기준으로 다시 검토하자 다른 결론에 도달했다. 우리는 빠르게 만들고 배포하며, 검증 결과에 따라 운영을 종료하기도 하는 micro SaaS 프로젝트가 많다. 이런 환경에서는 모든 컴포넌트를 중앙에서 장기간 통제하는 방식보다, 검증된 초기 구현을 제공하고 각 프로젝트가 맥락에 맞게 수정하는 구조가 더 적합할 수 있었다. 이번 글에서는 디자인 시스템을 **npm 라이브러리 패키지** 가 아닌 **shadcn-style Registry** 로 배포하기로 한 판단 과정과 구현 경계를 정리한다.

## [sort1] 3. 왜 배포 방식부터 결정했는가

디자인 시스템을 만든다는 말에는 여러 문제가 섞여 있다.

- 어떤 디자인 토큰(design token)을 만들 것인가
- Button의 공개 API는 어떻게 정할 것인가
- Figma와 코드의 이름을 어떻게 맞출 것인가
- Storybook을 사용할 것인가
- React와 Vue를 모두 지원할 것인가
- npm 패키지로 배포할 것인가, 소스 코드를 프로젝트에 설치할 것인가

이 가운데 가장 먼저 정해야 했던 것은 **배포 방식** 이었다. 배포 방식에 따라 설치된 컴포넌트의 소유권이 달라진다. 소유권이 정해져야 버전 관리(versioning), 프로젝트별 수정, 마이그레이션 전략도 정할 수 있다. 검토한 선택지는 크게 두 가지였다.

```text
1. npm 라이브러리 패키지를 설치하고 참조하는 방식
2. Registry에서 소스 코드를 받아 프로젝트에 설치하는 방식
```

## [sort1] 4. 왜 npm 패키지 방식이 매력적으로 보였는가

npm 패키지 방식은 익숙하다. [npm package](https://docs.npmjs.com/about-packages-and-modules/)는 재사용 가능한 코드를 배포하고 다른 프로젝트가 의존성으로 설치할 수 있게 하는 단위다. 디자인 시스템을 하나의 패키지로 배포하면 각 프로젝트는 이를 의존성으로 설치한다.

```bash
pnpm add @editor/design-system
```

```tsx
import { Button, TextField } from '@editor/design-system';
```

장점은 명확하다.

| 기준          | npm 패키지 방식의 장점                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| 버전 관리     | `@editor/design-system@1.2.0`처럼 소비 중인 버전을 식별할 수 있다.            |
| 업데이트 경로 | 수정 버전을 배포하고 각 앱이 의존성 버전을 올리는 일관된 경로를 만들 수 있다. |
| 구현 일관성   | 여러 앱이 같은 패키지 구현을 참조하므로 코드가 프로젝트마다 갈라지기 어렵다.  |
| API 관리      | 디자인 시스템 팀이 컴포넌트의 공개 API와 변경 정책을 중앙에서 관리하기 좋다.  |

장기간 운영하는 제품이 많고 여러 팀이 같은 UI 규칙을 유지해야 한다면 npm 패키지 방식은 강한 선택지다. 하지만 Electron 기반 멀티미디어 편집기 데스크톱 앱과 그 주변 micro SaaS 제품군을 함께 운영하는 환경에서는 이 장점이 운영 비용으로 바뀔 수 있었다.

## [sort1] 5. 왜 micro SaaS에서는 패키지의 비용이 커졌는가

우리에게는 “모든 앱이 같은 Button 구현을 계속 공유한다”는 목표보다 “쓸 만한 Button으로 빠르게 시작하고, 제품 맥락에 맞게 바로 고친다”는 목표가 더 중요했다. 예를 들어 한 프로젝트에서는 Button 클릭에 분석 이벤트가 필요하고, 다른 프로젝트에서는 로딩 아이콘의 위치가 달라야 하며, 또 다른 프로젝트에서는 특정 화면의 모서리 반경만 달라야 한다고 해보자. 공통 패키지에서 모든 요구를 수용하면 프로젝트별 예외가 공개 prop으로 올라오기 쉽다.

```tsx
<Button variant="primary" loadingPlacement="left" trackingEvent="project_create_click" projectSpecificRadius="compact">
  생성하기
</Button>
```

이 API가 항상 잘못된 것은 아니다. 다만 각 옵션이 여러 제품에서 반복해서 필요한지 검증하지 않은 채 추가되면, 공통 컴포넌트가 프로젝트별 정책까지 떠안는다. 그 결과 Button은 재사용 가능한 UI 계약이 아니라 예외를 누적한 추상화가 될 수 있다. 여기서 얻은 첫 번째 기준은 단순했다.

> 중앙에서 장기간 관리할 컴포넌트와 프로젝트가 빠르게 소유해야 하는 컴포넌트는 배포 방식이 달라야 한다.

## [sort1] 6. shadcn Registry는 무엇이 다른가

npm 패키지 방식에서는 컴포넌트 구현이 일반적으로 `node_modules` 안에 있고, 앱은 패키지가 공개한 API를 참조한다.

```text
node_modules/@editor/design-system/button
```

반면 shadcn Registry에서는 CLI가 Registry item에 정의된 소스 파일과 의존성을 대상 프로젝트에 설치한다. 여기서 Registry는 일반적인 저장소 전체를 뜻하는 말이 아니다. [shadcn Registry](https://ui.shadcn.com/docs/registry)가 정의하는 component, block, style, dependency 정보를 CLI가 읽고 대상 프로젝트에 설치하는 code registry를 뜻한다.

```bash
pnpm dlx shadcn@latest add https://editor-ui.internal/r/button.json
```

설치 후 컴포넌트는 앱 저장소 안의 파일이 된다.

```text
src/components/ui/button.tsx
src/styles/editor-tokens.css
```

정확히 말하면 **소스 코드 배포(source-code distribution)** 가 상위 개념이고, **shadcn Registry를 통한 코드 설치** 가 이번에 선택한 구체적인 메커니즘이다. 두 방식의 핵심 차이는 설치 이후의 소유권이다.

```text
npm 패키지
-> 패키지 저장소가 구현을 소유하고, 앱은 공개 API에 의존한다.

shadcn Registry
-> 앱 저장소가 설치된 구현을 소유하고, 필요하면 직접 수정한다.
```

## [sort1] 7. Registry 방식으로 무엇을 얻고 무엇을 포기하는가

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

Electron 기반 멀티미디어 편집기 데스크톱 앱과 그 주변 제품군의 운영 환경은 두 번째 조건에 더 가까웠다. 이것이 Registry를 선택한 필요조건은 아니지만, 선택의 주요 근거였다.

## [sort1] 8. Registry 방식과 라이브러리 방식은 어떻게 다른가

앞에서 npm 패키지 방식과 Registry 방식을 따로 봤지만, 실제 의사결정은 “어떤 도구가 더 좋은가”보다 “설치 후 컴포넌트 코드를 누가 소유하는가”에 가까웠다. 여기서 **라이브러리 방식** 은 UI component를 npm package로 배포하고, 소비 프로젝트가 `import`해서 사용하는 방식을 뜻한다. 라이브러리화는 컴포넌트 파일을 한 저장소에 모아두는 행위가 아니다. 소비 앱이 안정적으로 import할 수 있는 package entry point, `peerDependencies`, CSS 배포 경로, TypeScript 선언 파일, semver release 정책까지 포함하는 배포 계약이다. 반대로 Registry 방식은 완성된 bundle을 참조하게 만드는 것이 아니라, 검증된 소스 코드를 소비 앱 안으로 복사해 시작점을 제공한다.

| 기준              | 라이브러리 방식                                     | Registry 방식                                             |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------- |
| 설치 결과         | `node_modules` 안의 package를 참조한다.             | 앱 저장소 안에 component 소스 파일이 생긴다.              |
| 소유권            | 원본 package가 구현을 소유한다.                     | 설치 후 앱이 구현을 소유한다.                             |
| 변경 전파         | package version을 올려 변경을 가져온다.             | 원본 변경은 자동 전파되지 않고 별도 migration이 필요하다. |
| 프로젝트별 수정   | 공개 API나 theme 확장 지점 안에서 수정한다.         | 앱 코드처럼 직접 수정할 수 있다.                          |
| 중앙 일관성       | 상대적으로 유지하기 쉽다.                           | 프로젝트별 편차를 별도로 추적해야 한다.                   |
| micro SaaS 적합성 | 장기 운영과 공통 규칙 유지가 더 중요할 때 유리하다. | 빠른 도입과 제품별 변형이 더 중요할 때 유리하다.          |

따라서 “라이브러리 방식이 구식이고 Registry가 최신”이라는 판단은 아니다. 두 방식은 해결하는 문제가 다르다. 라이브러리 방식은 중앙에서 UI 구현을 오래 유지하는 데 강하고, Registry 방식은 검증된 초기 구현을 각 제품이 빠르게 자기 코드로 흡수하는 데 강하다.

## [sort1] 9. Next.js, Vite, 다른 라이브러리 빌드 도구를 어떻게 비교했는가

회사에서 이미 Next.js와 Vite를 모두 사용하고 있었기 때문에, 디자인 시스템 원본을 만들 때도 두 도구를 먼저 비교했다. 여기에 package 배포를 더 강하게 전제하는 Rollup, tsdown, Rolldown 같은 bundler도 후보군으로 두었다. 이 비교에서 **Next.js** 는 React application framework로 보았다. [Next.js 공식 문서](https://nextjs.org/docs)는 Next.js를 full-stack web application을 만들기 위한 React framework로 설명한다. `next build` 역시 production application build를 만드는 명령이다. 따라서 docs site나 Registry JSON을 제공하는 웹 서버에는 잘 맞지만, component library artifact를 만드는 중심 도구로 보기는 어렵다. **Vite** 는 application 개발 서버와 production build를 제공하면서도 [Library Mode](https://vite.dev/guide/build.html#library-mode)를 별도로 제공한다. 즉 같은 도구로 playground를 실행하고, 필요하면 browser-oriented library bundle까지 만들 수 있다.

Rollup, tsdown, Rolldown은 더 직접적인 bundler 선택지다. [Rollup](https://rollupjs.org/introduction/)은 library나 application bundle을 만들 수 있는 JavaScript module bundler이고, [tsdown](https://tsdown.dev/guide/)은 TypeScript library build에 초점을 둔 도구다. 이 도구들은 package-first 전략에서는 강한 후보지만, Registry-first 전략에서는 첫 단계부터 도입할 필요조건은 아니었다. 정리하면 다음과 같았다.

| 도구                | 이 글에서 본 중심 역할                        | 디자인 시스템에서 가능한 역할                  | 판단                                                                   |
| ------------------- | --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Next.js             | React application framework                   | 문서 사이트, Registry endpoint, 예제 앱        | 회사에서 쓰고 있지만 library artifact build가 중심 목표는 아니다.      |
| Vite                | frontend build tool + Library Mode            | playground, docs preview, 선택적 package build | 회사에서 쓰고 있고 Library Mode가 있어 초기 원본 개발 도구로 적합했다. |
| Rollup              | JavaScript module bundler                     | npm package bundle 생성                        | package-first가 되면 검토할 수 있지만 초기 Registry-first에는 과했다.  |
| tsdown/Rolldown     | library-oriented 또는 고성능 bundler          | TypeScript library bundle과 선언 파일 생성     | library 배포를 본격화할 때 분리 도입할 수 있다.                        |
| Storybook/Chromatic | component 상태 문서화와 UI regression testing | component 검증과 리뷰                          | 배포 도구가 아니라 검증 도구로 분리한다.                               |

## [sort1] 10. 그중 왜 Vite를 선택했는가

Vite를 선택한 이유는 “Vite가 Next.js보다 항상 낫다”가 아니다. 우리 조건에서는 **회사에서 이미 쓰는 선택지 중 library mode를 가진 도구가 Vite였기 때문** 이다. Next.js는 제품 앱과 문서 사이트를 만들 때 강한 선택지다. 하지만 이 작업에서 필요한 것은 application route, server rendering, deployment adapter가 아니라 component 원본을 빠르게 개발하고 필요할 경우 library artifact로도 내보낼 수 있는 빌드 경로였다. Vite는 이 요구에 더 직접적으로 맞았다.

```text
필요했던 것
- React component를 빠르게 실행해 볼 playground
- 디자인 토큰 CSS와 component 상태를 확인할 preview
- package 배포로 전환할 경우 사용할 수 있는 Library Mode
- 회사에서 이미 사용 중인 도구라 추가 학습 비용이 낮은 선택지
```

이 판단은 현재 조건에 근거한 선택이다. 만약 처음부터 npm package 배포가 핵심 목표였고, declaration file bundle, multi-entry output, external dependency 정책이 더 중요했다면 tsdown이나 Rollup을 먼저 선택했을 가능성도 있다.

## [sort1] 11. Registry를 선택하면 Vite의 역할은 어떻게 달라지는가

초기에는 Vite의 Library Mode 중심으로 npm package를 만드는 안도 검토했다. Vite Library Mode는 브라우저 지향 라이브러리를 배포 가능한 JavaScript 번들로 만들 때 사용하는 빌드 설정이다. 일반 앱 빌드와 라이브러리 빌드는 목표가 다르다.

| 구분        | 일반 앱 빌드                     | Library Mode                                         |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| 대표 진입점 | `index.html`                     | `src/index.ts` 같은 라이브러리 진입 모듈             |
| 목표        | 브라우저에서 실행할 앱 배포      | 다른 프로젝트가 소비할 라이브러리 번들 배포          |
| 의존성 처리 | 앱 실행에 필요한 코드를 묶음     | React 같은 의존성을 외부화하도록 별도 설정할 수 있음 |
| 대표 산출물 | HTML, JavaScript, CSS, 정적 파일 | ESM·CJS 등의 JavaScript 번들과 추출된 CSS            |

TypeScript 선언 파일은 Library Mode 자체가 자동으로 보장하는 산출물이 아니다. 패키지로 배포하려면 TypeScript 설정이나 별도 플러그인으로 선언 파일 생성 과정을 구성해야 한다. `@editor/design-system` 패키지를 만들었다면 Library Mode가 배포 파이프라인의 중심이 되었을 것이다. 그러나 Registry 방식에서는 컴포넌트를 하나의 번들로 묶는 것보다 소스 파일, 의존성, 설치 경로를 Registry item에 정확히 정의하는 일이 더 중요하다. 그래서 Vite의 책임을 다음과 같이 좁혔다.

```text
Vite의 역할
- Registry 컴포넌트 개발용 playground 실행
- 문서와 preview 사이트 빌드
- Button, TextField, Dialog의 상태를 브라우저에서 확인
```

Vite는 npm 패키지를 만드는 중심 도구가 아니라 Registry 컴포넌트를 개발하고 검증하는 실행 환경이 된다.

## [sort1] 12. shadcn을 사용한다는 말의 범위를 어떻게 정했는가

“shadcn을 사용한다”는 말은 shadcn/ui의 시각 디자인과 Tailwind 기반 구현을 그대로 가져온다는 뜻으로 오해하기 쉽다. [shadcn/ui 공식 문서](https://ui.shadcn.com/docs)는 shadcn/ui를 component 모음이자 code distribution platform으로 설명한다. 이 글에서는 shadcn/ui의 기본 시각 디자인보다 Registry와 CLI 기반 소스 설치 흐름에 초점을 둔다. 하지만 Electron 기반 멀티미디어 편집기 데스크톱 앱 프로젝트는 Emotion을 사용한다. Tailwind class 중심의 컴포넌트를 그대로 섞으면 한 컴포넌트 계층에서 두 스타일링 체계를 함께 운영하게 된다.

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

즉 shadcn은 Electron 기반 멀티미디어 편집기 데스크톱 앱의 디자인 언어가 아니라 **소스 코드 배포 메커니즘** 으로 사용한다.

## [sort1] 13. 왜 Radix UI를 접근성 Primitive로 사용하는가

Dialog, DropdownMenu, Tooltip 같은 컴포넌트는 `div`를 시각적으로 꾸미는 것만으로 완성되지 않는다. [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)는 낮은 수준의 접근성 UI primitive를 제공한다. 이 글에서는 Radix UI를 Dialog, DropdownMenu, Tooltip 같은 복잡한 상호작용의 base layer로 사용한다. Dialog를 구현하려면 다음 동작과 의미 구조를 함께 고려해야 한다.

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
  background: var(--editor-color-surface-floating);
  border-radius: var(--editor-radius-medium);
`;
```

각 도구의 책임은 다음과 같이 나뉜다.

```text
Radix UI
= 접근성 의미 구조, 키보드 상호작용, 초점 관리

Emotion
= 멀티미디어 편집기 컴포넌트 스타일 구현

CSS 변수
= Figma 디자인 토큰과 연결되는 값의 계약
```

이 구조는 Registry 방식과도 맞는다. 프로젝트는 설치된 컴포넌트 코드를 소유하고, 복잡한 접근성 동작은 Radix UI Primitive의 계약에 의존한다. 다만 Radix UI를 사용한다는 사실만으로 완성된 접근성이 보장되지는 않는다. Dialog의 제목과 설명을 제공하고, 설치 후 수정한 상호작용을 다시 검증하는 책임은 여전히 프로젝트에 있다.

## [sort1] 14. 왜 Emotion은 유지하고 디자인 토큰은 CSS 변수로 두는가

Emotion은 React 컴포넌트의 스타일 구현에 사용한다.

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

하지만 디자인 토큰 자체를 Emotion theme에만 넣지는 않기로 했다. 여기서 **디자인 토큰(design token)** 은 색상, 모서리 반경, 간격, typography 같은 UI 결정을 이름 있는 값으로 표현한 계약이다. 디자인 토큰은 특정 React 구현보다 오래 유지될 수 있어야 한다. 현재는 React를 우선 지원하지만 Vue 프로젝트도 존재하기 때문에 색상과 모서리 반경 같은 기준 값은 CSS 변수로 제공하는 편이 이식성에 유리하다고 판단했다.

```css
:root {
  --editor-color-surface-primary: #ffffff;
  --editor-color-text-primary: #000000;
  --editor-radius-none: 0px;
  --editor-radius-small: 1px;
  --editor-radius-medium: 2px;
  --editor-radius-full: 999px;
}

[data-theme='dark'] {
  --editor-color-surface-primary: #2c2c2c;
  --editor-color-text-primary: #ffffff;
}
```

이렇게 나누면 Emotion은 React 컴포넌트의 구현 도구가 되고, CSS 변수 이름과 값은 여러 프레임워크가 공유할 수 있는 디자인 토큰 계약이 된다.

## [sort1] 15. Figma와 코드의 이름을 왜 맞춰야 하는가

코드 구현 전에 Figma의 표현 모델과 코드의 공개 API가 같은 의미를 가리키는지 확인해야 했다. 현재 디자인 파일을 검토하며 다음 정리 항목을 찾았다.

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
    background: var(--editor-color-interactive-button-primary-hovered);
  }
`;
```

디자이너와의 합의는 구현 허락을 받는 절차가 아니다. Figma의 variant, state, token과 코드의 prop, CSS state, CSS 변수가 같은 개념을 표현하도록 계약을 맞추는 일이다. 이 계약이 어긋나면 단순한 색상 차이를 넘어 팀이 같은 컴포넌트를 서로 다른 상태 모델로 이해하게 된다.

## [sort1] 16. Storybook을 어떤 검증 도구로 사용할 것인가

Storybook은 디자인 시스템 자체가 아니다. [Storybook 공식 문서](https://storybook.js.org/docs)는 Storybook을 앱 전체를 실행하지 않고 UI component와 page를 독립적으로 만들고 테스트하는 frontend workshop으로 설명한다. 이 글에서는 앱 화면과 분리된 환경에서 UI 컴포넌트의 상태를 개발하고 문서화하며 테스트할 수 있게 돕는 도구로 사용한다. [Chromatic](https://www.chromatic.com/docs/)은 Storybook story를 사용해 visual, interaction, accessibility test를 실행하는 클라우드 기반 UI 검증 도구다. 즉 Storybook이 component 상태 예제를 만드는 환경이라면, Chromatic은 그 예제를 기준으로 변경을 검토하는 검증 경로에 가깝다. Registry 방식을 선택해도 독립 검증 환경은 필요하다. Button만 해도 다음 상태 조합을 확인해야 한다.

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

빠르게 변하는 micro SaaS에서는 앱 화면 안에서 확인한 상태만 구현하고 나머지 조합을 놓치기 쉽다. Story를 상태별 실행 예제로 두면 시각 검토뿐 아니라 상호작용 테스트와 접근성 테스트의 입력으로도 활용할 수 있다. 따라서 Storybook은 Registry의 배포 책임을 대신하지 않는다. 설치하기 전 원본 컴포넌트의 상태 조합을 반복해서 검증하는 경로를 제공한다.

## [sort1] 17. 최종 구조를 어떻게 설계했는가

최종적으로 다음 구조를 계획했다.

```text
editor-ui
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
│  └─ editor-tokens.css
│
└─ public
   └─ r
      ├─ registry.json
      ├─ button.json
      ├─ text-field.json
      └─ timeline-editor.json
```

여기서 `registry.json`은 Registry item 목록과 파일 관계를 정의하는 원본이고, `public/r` 아래 JSON은 배포 과정에서 생성해 HTTP로 제공할 결과물이다. 첫 구현 범위는 작게 잡았다.

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

## [sort1] 18. npm 패키지 대신 Registry를 선택하며 배운 것

이 글의 결론은 “npm 패키지는 틀렸고 shadcn Registry가 맞다”가 아니다.

> 디자인 시스템의 배포 방식은 조직이 운영하는 제품의 수명과 커스터마이징 방식에 맞아야 한다.

장기 운영 제품이 많고 중앙에서 UI 일관성과 마이그레이션을 관리해야 한다면 npm 패키지가 더 적합할 수 있다. 반면 Electron 기반 멀티미디어 편집기 데스크톱 앱과 그 주변 micro SaaS 제품군처럼 각 프로젝트가 빠르게 변형되어야 한다면 Registry가 더 현실적인 선택일 수 있다. 우리는 중앙 통제력과 자동 업데이트 경로 일부를 포기한다. 대신 프로젝트별 코드 소유권, 빠른 초기 도입, 제품 맥락에 맞춘 수정 가능성을 얻는다. 이 선택은 micro SaaS 제품군에서 필요한 속도와 변형 가능성을 우선한 운영 모델이다. 결국 디자인 시스템은 컴포넌트 파일을 모아 둔 저장소가 아니다. 팀이 어떤 속도로 제품을 만들고 어떤 책임 경계로 UI를 소유할지 정하는 운영 모델에 가깝다.

> 좋은 디자인 시스템은 모든 변화를 막는 규칙이 아니라, 각 프로젝트가 검증된 출발점에서 자기 답을 찾게 만드는 기반이어야 한다.

## 참고 자료

- [Figma가 설명하는 디자인 시스템의 기본 개념](https://www.figma.com/resource-library/design-system-examples/)
- [Figma가 정리한 디자인 시스템 입문 가이드](https://www.figma.com/blog/design-systems-101-what-is-a-design-system/)
- [Figma가 설명하는 디자인 토큰의 역할](https://www.figma.com/resource-library/design-tokens/)
- [Adobe가 정리한 디자인 시스템 확장 전략](https://blog.adobe.com/en/publish/2021/05/26/best-practices-to-scale-design-with-design-systems)
- [npm 공식 문서의 package와 module 개념](https://docs.npmjs.com/about-packages-and-modules/)
- [Next.js 공식 문서의 React application framework 설명](https://nextjs.org/docs)
- [Shopify Polaris를 만들게 된 배경](https://www.shopify.com/partners/blog/design-system)
- [shadcn/ui Registry의 구조와 역할](https://ui.shadcn.com/docs/registry)
- [shadcn/ui Registry를 시작하는 방법](https://ui.shadcn.com/docs/registry/getting-started)
- [shadcn/ui가 설명하는 code distribution platform 개념](https://ui.shadcn.com/docs)
- [Vite 공식 문서의 Library Mode 설명](https://vite.dev/guide/build.html#library-mode)
- [Rollup 공식 문서의 JavaScript module bundler 개요](https://rollupjs.org/introduction/)
- [tsdown 공식 문서의 TypeScript library build 개요](https://tsdown.dev/guide/)
- [Spotify Engineering이 설명하는 디자인 시스템의 추상화 계층](https://engineering.atspotify.com/2023/05/multiple-layers-of-abstraction-in-design-systems)
- [Radix Primitives의 접근성 원칙](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Radix Primitives가 제공하는 UI primitive 개요](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Storybook 공식 문서의 frontend workshop 개념](https://storybook.js.org/docs)
- [Storybook 공식 문서의 UI 테스트 흐름](https://storybook.js.org/docs/writing-tests)
- [Chromatic이 제공하는 Storybook 기반 UI 검증 흐름](https://www.chromatic.com/docs/)
