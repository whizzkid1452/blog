---
title: 'Design System 구축기'
description: 'VOIX KIT·TOOL과 마이크로 SaaS의 공통 UI를 위해 Registry 배포, Flat·Compound API, Tokens Studio와 GitHub Actions 기반 토큰 자동화를 구축한 과정을 정리합니다.'
date: '2026-07-10'
tags: ['design-system', 'shadcn', 'tokens-studio', 'frontend', 'architecture']
draft: false
featured: true
---

버튼 하나를 만들 때마다 "이 버튼의 `disabled` 상태에서 `hover` 처리는 어떻게 하죠?", "텍스트 필드의 상태(`error`, `focused`, `disabled`) 이름은 뭘로 할까요?" 같은 질문이 제품마다 반복되었습니다. 심지어 Figma의 variant 이름과 코드의 prop 이름이 달라서 매번 "어느 쪽이 진짜 기준인가요?"라고 묻는 일도 잦았죠.

VOIX KIT·TOOL처럼 AI 음원 생성과 결과물 공유를 제공하는 제품을 확장하면서, 제품마다 공통 UI를 다시 정의하는 문제가 있었습니다. 저는 여러 마이크로 SaaS에서 사용할 컴포넌트 배포 구조와 API, 디자인 토큰 자동화 파이프라인을 구축했습니다.

핵심 선택은 **컴포넌트 소스를 제품에 전달하는 Registry 방식과, CSS 변수로 공유하는 디자인 토큰**이었습니다. 공통 시작점은 제공하되 제품별 수정 권한을 남기는 이유와 그 비용을 정리합니다.

---

## [sort1] 1. 디자인 시스템, 통제할 것인가 유연하게 둘 것인가?

처음 기획을 시작할 때는 당연히 여러 프로젝트에서 동일한 구현을 유지하기 위해 npm 패키지 형태로 배포해야 한다고 생각했습니다. 중앙에서 일관성을 통제하고 패키지 버전만 올리면 업데이트가 되는 편리한 방식이니까요.

하지만 제품마다 도메인과 화면 요구가 달랐습니다. 공통 컴포넌트에서 시작한 뒤 **각 프로젝트가 소스를 수정할 수 있는 경로**가 필요했습니다.

패키지 방식에서도 확장 지점을 설계할 수 있습니다. 다만 이 환경에서는 제품별 예외를 공통 패키지에 계속 추가하는 비용보다, 각 제품이 소스를 소유하는 비용을 선택했습니다.

### [sort2] 1-1. 💡 결정: shadcn 스타일의 Registry 배포 방식

따라서 우리는 npm 패키지가 아닌 **Registry 방식**을 선택했습니다. CLI를 통해 컴포넌트 소스 코드를 프로젝트 내부로 직접 복사해 오는 방식입니다.

- **변경 경로:** 복사된 컴포넌트는 각 프로젝트에서 수정합니다. 공통 패키지의 다음 배포를 기다리지 않고 제품 요구를 반영할 수 있습니다.
- **선택의 근거:** 마이크로 SaaS의 공통 시작점을 제공하면서 제품별 요구를 수용하기 위한 선택입니다. 복사 이후의 공통 수정은 각 제품에 별도로 반영해야 합니다.

---

## [sort1] 2. API 설계: Flat과 Compound, 무엇이 정답일까?

배포 방식을 Registry로 결정하여 '수정의 자유'를 주었지만, 컴포넌트를 설계하는 방식(API) 자체도 확장성을 고려해야 했습니다. 이 과정에서 [토스 테크 블로그의 '디자인 시스템 다시 생각해보기'](https://toss.tech/article/rethinking-design-system) 글이 큰 영감을 주었습니다. 컴포넌트 API는 크게 두 가지로 나뉩니다.

**1) Flat 패턴**
내부 구조를 숨기고 모든 변형을 `props`로 제어하는 방식입니다.

- _장점:_ `<Card actionLabel="다운로드" title="리포트"/>`처럼 사용법이 매우 직관적이고 간단합니다.
- _비용:_ 버튼을 링크로 바꾸거나 특정 영역에 배지를 추가할 때 API의 확장 지점을 마련해야 합니다.

**2) Compound 패턴**
하위 컴포넌트를 제공하여 조합해 쓰는 방식입니다.

- _장점:_ `<Card><Card.Title>리포트</Card.Title></Card>`처럼 하위 구조를 직접 조합할 수 있습니다.
- _비용:_ 사용자가 각 조각의 역할과 조합 규칙을 알아야 하고, 단순한 화면에서도 작성할 코드가 늘어납니다.

### [sort2] 2-1. 💡 결정: 하이브리드 전략 (Primitive 기반의 Flat API 제공)

우리는 **둘 다 제공하는 하이브리드 방식**을 취하기로 했습니다.
내부적으로는 Radix UI와 결합된 Compound 패턴(Primitive)으로 유연한 기본 조각들을 만듭니다. 하지만 마이크로 SaaS의 핵심인 '빠른 시작'을 위해, 이 조각들을 미리 조립한 **Flat 패턴의 API를 기본으로 제공**합니다. 만약 프로젝트에서 특수한 구조 변경이 필요하다면 Registry로 복사해 온 코드 내부의 Compound 구조를 직접 수정(커스터마이징)하면 됩니다.

---

## [sort1] 3. 기술 스택 선택의 근거

Registry 배포 방식과 유연한 API 설계를 뒷받침할 기술 스택은 다음과 같이 구성했습니다.

- **Vite와 Storybook:** 컴포넌트 개발 환경을 구성하고, 상태별 화면과 사용 예시를 Storybook에 문서화했습니다.
- **shadcn 배포 모델 + Emotion 스타일링:** shadcn의 훌륭한 '배포 CLI'는 가져오되, Tailwind 기반 스타일링은 제외했습니다. 기존 앱들이 이미 Emotion을 쓰고 있기 때문에 혼선을 줄이기 위함입니다.
- **Radix UI:** Dialog, DropdownMenu 등의 기본 상호작용을 Primitive에 위임했습니다. 제품에서 조합한 뒤의 키보드 이동과 포커스 동작은 별도로 확인해야 합니다.

---

## [sort1] 4. 디자인 토큰 관리: CSS 변수와 Tokens Studio 연동

색상, 간격, 모서리 반경 등의 디자인 값을 토큰으로 관리하고 **CSS 변수**로 추출했습니다. 토큰의 전달 형식이 React나 Emotion에 종속되지 않으므로 Vue 화면에서도 같은 값을 참조할 수 있습니다. React 컴포넌트 코드 자체를 Vue에서 재사용한다는 뜻은 아닙니다.

특히 디자이너와 프론트엔드 개발자 간의 싱크를 맞추기 위해 **Tokens Studio를 GitHub와 연동**했습니다.
디자이너가 Figma의 Tokens Studio에서 수정한 토큰을 GitHub로 전달하면, GitHub Actions가 CSS 변수 파일로 변환하는 파이프라인을 구축했습니다. Figma와 코드가 같은 토큰 이름과 값을 사용하도록 연결한 것입니다.

컴포넌트 상태와 사용 예시는 Storybook에 남겼습니다. 토큰 생성과 컴포넌트 배포는 서로 다른 경로이므로, 토큰 변경만으로 Registry에서 이미 복사한 컴포넌트 구현까지 갱신되지는 않습니다.

**💻 구현 예시 (Button 컴포넌트)**

아래 코드는 CSS 변수를 소비하는 원리를 보여주기 위해 단순화한 예제입니다.

```tsx
import styled from '@emotion/styled';
import type { ComponentPropsWithoutRef } from 'react';

// CSS 변수로 주입된 토큰을 활용한 Emotion 스타일링
const ButtonRoot = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  /* Tokens Studio에서 자동 생성된 CSS 변수 사용 */
  background-color: var(--color-interactive-button-primary-enabled);
  color: var(--color-text-on-dark);
  border-radius: var(--radius-small);
  padding: var(--spacing-sm) var(--spacing-md);

  &:hover {
    background-color: var(--color-interactive-button-primary-hovered);
  }

  &:disabled {
    background-color: var(--color-interactive-button-disabled);
    cursor: not-allowed;
  }
`;

export function Button({ children, ...props }: ComponentPropsWithoutRef<'button'>) {
  return <ButtonRoot {...props}>{children}</ButtonRoot>;
}
```

---

## [sort1] 5. 구조 분리: Component와 Block

디자인 시스템은 Registry를 통해 복사해 갈 수 있는 단위를 두 가지로 나누었습니다.

1. **Component (UI 단위):** Button, TextField, Dialog 등 범용적인 UI 요소
2. **Block (화면 단위):** Login Page, Dashboard Shell 등 여러 컴포넌트가 조합된 완성형 화면

Block은 제품 화면의 출발점으로 사용합니다. 도메인 의존성이 높은 부분은 복사 후 제품이 수정하고, 범용 Component와 토큰은 공통 기준으로 유지합니다.

---

## [sort1] 6. 주요 리스크와 방어 전략

Registry 방식을 선택하면서 다음 비용도 관리해야 했습니다.

- **파편화 리스크:** 프로젝트별로 코드를 수정하다 보면 나중엔 완전히 다른 버튼이 될 수 있습니다.
  _대응 기준:_ 공통 변경의 적용 여부를 각 제품에서 확인하고, 여러 제품에 같은 수정을 반복하게 되면 패키지 배포를 다시 검토합니다.
- **토큰 이름 불안정:** Figma에서 이름이 바뀌면 코드도 흔들립니다.
  _대응 기준:_ 토큰 이름을 바꿀 때 Figma와 코드의 참조를 함께 확인합니다. CSS 변수 생성 성공만으로 기존 참조까지 교체됐다고 판단하지 않습니다.

---

## [sort1] 7. 확인한 변화와 적용 기준

컴포넌트 설치·수정 경로, Flat·Compound API, 토큰 변환 파이프라인과 Storybook의 사용 기준을 마련했습니다. 제품별 UI 개발 시간이나 커뮤니케이션 비용의 감소율은 별도로 측정하지 않았습니다.

- [ ] 제품이 공통 컴포넌트의 소스를 직접 수정해야 하는지 확인합니다.
- [ ] 복사 이후 공통 수정 사항을 전달할 경로를 정합니다.
- [ ] 생성된 CSS 변수와 Figma의 토큰 참조가 맞는지 확인합니다.
- [ ] Storybook의 상태별 예시와 실제 제품의 접근성 동작을 함께 확인합니다.

이 환경에서 디자인 시스템의 핵심은 공통 코드의 양보다 변경 권한의 위치였습니다. 토큰은 함께 관리하고, 제품별 구현은 각 제품이 소유하도록 경계를 정했습니다.

## 참고

- [shadcn/ui: Registry](https://ui.shadcn.com/docs/registry)
