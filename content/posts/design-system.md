---
title: 'Design System 구축기'
description: "이 글에서는 디자인 시스템을 기획하면서, 당연하게 여겨지던 'npm 패키지 배포' 대신 'shadcn 스타일의 Registry 배포 방식'을 선택한 이유와, 프론트엔드 API 설계에 대한 치열했던 고민을 공유합니다."
date: '2026-07-10'
tags: ['design-system', 'shadcn', 'tokens-studio', 'frontend', 'architecture']
draft: false
featured: true
---

버튼 하나를 만들 때마다 "이 버튼의 `disabled` 상태에서 `hover` 처리는 어떻게 하죠?", "텍스트 필드의 상태(`error`, `focused`, `disabled`) 이름은 뭘로 할까요?" 같은 질문이 제품마다 반복되었습니다. 심지어 Figma의 variant 이름과 코드의 prop 이름이 달라서 매번 "어느 쪽이 진짜 기준인가요?"라고 묻는 일도 잦았죠.

새로운 마이크로 SaaS 프로젝트가 런칭될 때마다 똑같은 UI 파편화 문제를 겪으면서, 우리 조직에도 드디어 공통의 기준인 **UI 디자인 시스템**이 필요하다는 공감대가 형성되었습니다.

이 글에서는 디자인 시스템을 기획하면서, 당연하게 여겨지던 'npm 패키지 배포' 대신 'shadcn 스타일의 Registry 배포 방식'을 선택한 이유와, 프론트엔드 API 설계에 대한 치열했던 고민을 공유합니다.

---

## [sort1] 1. 디자인 시스템, 통제할 것인가 유연하게 둘 것인가?

처음 기획을 시작할 때는 당연히 여러 프로젝트에서 동일한 구현을 유지하기 위해 npm 패키지 형태로 배포해야 한다고 생각했습니다. 중앙에서 일관성을 통제하고 패키지 버전만 올리면 업데이트가 되는 편리한 방식이니까요.

하지만 우리 조직의 현실은 조금 달랐습니다. 빠르게 만들고 배포했다가 사라지기도 하는 마이크로 SaaS 프로젝트가 다수 존재했고, 중앙 집중적인 통제보다는 각 프로젝트 상황에 맞는 **빠른 시작점과 유연한 커스터마이징**이 압도적으로 중요했습니다.

패키지 방식을 사용하면, 각 프로젝트의 예외적인 디자인 요구를 수용하기 위해 컴포넌트의 prop이 끝도 없이 늘어나는 병목 현상이 생길 수밖에 없었습니다.

### [sort2] 1-1. 💡 결정: shadcn 스타일의 Registry 배포 방식

따라서 우리는 npm 패키지가 아닌 **Registry 방식**을 선택했습니다. CLI를 통해 컴포넌트 소스 코드를 프로젝트 내부로 직접 복사해 오는 방식입니다.

- **장점:** 복사된 순간부터 컴포넌트의 '소유권'은 각 프로젝트가 가집니다. 공통 컴포넌트를 기반으로 프로젝트 입맛에 맞게 코드를 즉각적으로 수정할 수 있어 개발 속도와 유연성이 극대화됩니다.
- **선택의 근거:** 우리의 목표는 '모든 프로젝트를 완벽히 통제'하는 것이 아니라, '마이크로 SaaS가 빠르게 시작할 수 있는 훌륭한 초기값을 제공'하는 것이기 때문입니다.

---

## [sort1] 2. API 설계: Flat과 Compound, 무엇이 정답일까?

배포 방식을 Registry로 결정하여 '수정의 자유'를 주었지만, 컴포넌트를 설계하는 방식(API) 자체도 확장성을 고려해야 했습니다. 이 과정에서 [토스 테크 블로그의 '디자인 시스템 다시 생각해보기'](https://toss.tech/article/rethinking-design-system) 글이 큰 영감을 주었습니다. 컴포넌트 API는 크게 두 가지로 나뉩니다.

**1) Flat 패턴**
내부 구조를 숨기고 모든 변형을 `props`로 제어하는 방식입니다.

- _장점:_ `<Card actionLabel="다운로드" title="리포트"/>`처럼 사용법이 매우 직관적이고 간단합니다.
- _단점:_ 예측하지 못한 요구사항(예: 버튼을 링크로 바꾸기, 특정 영역에만 뱃지 추가 등)이 생길 때마다 prop이 기형적으로 늘어납니다.

**2) Compound 패턴**
하위 컴포넌트를 제공하여 조합해 쓰는 방식입니다.

- _장점:_ `<Card><Card.Title>리포트</Card.Title>ಳು`처럼 구조를 직접 제어하므로 확장에 매우 유연합니다.
- _단점:_ 코드가 길어지고 구현 난이도와 러닝 커브가 높습니다. 단순한 기능만 필요할 때도 무거운 보일러플레이트를 작성해야 합니다.

### [sort2] 2-1. 💡 결정: 하이브리드 전략 (Primitive 기반의 Flat API 제공)

우리는 **둘 다 제공하는 하이브리드 방식**을 취하기로 했습니다.
내부적으로는 Radix UI와 결합된 Compound 패턴(Primitive)으로 유연한 기본 조각들을 만듭니다. 하지만 마이크로 SaaS의 핵심인 '빠른 시작'을 위해, 이 조각들을 미리 조립한 **Flat 패턴의 API를 기본으로 제공**합니다. 만약 프로젝트에서 특수한 구조 변경이 필요하다면 Registry로 복사해 온 코드 내부의 Compound 구조를 직접 수정(커스터마이징)하면 됩니다.

---

## [sort1] 3. 기술 스택 선택의 근거

Registry 배포 방식과 유연한 API 설계를 뒷받침할 기술 스택은 다음과 같이 구성했습니다.

- **Vite (개발 및 문서화 환경):** 현재 조직의 주력 스택이며, 컴포넌트를 빠르게 띄워보고 검증하는 데 최적입니다.
- **shadcn 배포 모델 + Emotion 스타일링:** shadcn의 훌륭한 '배포 CLI'는 가져오되, Tailwind 기반 스타일링은 제외했습니다. 기존 앱들이 이미 Emotion을 쓰고 있기 때문에 혼선을 줄이기 위함입니다.
- **Radix UI (접근성 및 상호작용):** Dialog, DropdownMenu 등의 WAI-ARIA 상호작용은 직접 구현하지 않고 Radix UI Primitive에 위임하여 안정성을 확보했습니다.

---

## [sort1] 4. 디자인 토큰 관리: CSS 변수와 Tokens Studio 연동

가장 중요한 시각적 일관성은 토큰(Token)으로 관리합니다. 색상, 간격, 모서리 반경 등의 토큰을 Emotion theme에 가두지 않고 순수 **CSS 변수**로 추출했습니다. 이를 통해 다크모드 전환이 쉽고, 향후 Vue 등 다른 프레임워크에서도 공통 토큰을 재사용할 수 있습니다.

특히 디자이너와 프론트엔드 개발자 간의 싱크를 맞추기 위해 **Tokens Studio를 GitHub와 연동**했습니다.
디자이너가 Figma에서 Tokens Studio 플러그인으로 색상이나 간격을 수정하고 Push하면, GitHub Actions가 이를 감지하여 CSS 변수 파일로 자동 변환하는 파이프라인을 구축할 예정입니다.

**💻 구현 예시 (Button 컴포넌트)**

```tsx
import styled from '@emotion/styled';

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

export function Button({ children, ...props }) {
  return <ButtonRoot {...props}>{children}</ButtonRoot>;
}
```

---

## [sort1] 5. 구조 분리: Component와 Block

디자인 시스템은 Registry를 통해 복사해 갈 수 있는 단위를 두 가지로 나누었습니다.

1. **Component (UI 단위):** Button, TextField, Dialog 등 범용적인 UI 요소
2. **Block (화면 단위):** Login Page, Dashboard Shell 등 여러 컴포넌트가 조합된 완성형 화면

마이크로 SaaS에서는 당장 화면을 그릴 수 있는 'Block'이 매우 유용합니다. 도메인 의존성이 높아 재사용성은 떨어지더라도, "빠르게 시작한다"는 시스템의 핵심 목표에 완벽하게 부합하기 때문입니다.

---

## [sort1] 6. 주요 리스크와 방어 전략

Registry 방식이 만능은 아니기에 다음과 같은 안전장치도 마련했습니다.

- **파편화 리스크:** 프로젝트별로 코드를 수정하다 보면 나중엔 완전히 다른 버튼이 될 수 있습니다.
  👉 _대응:_ Registry 컴포넌트에 변경 로그를 남기고, 훗날 장기 운영 프로젝트에서 공통화 필요성이 커지는 핵심 컴포넌트만 별도로 패키지화하는 전략을 취합니다.
- **토큰 이름 불안정:** Figma에서 이름이 바뀌면 코드도 흔들립니다.
  👉 _대응:_ Figma 이름을 맹목적으로 따르지 않고 코드 전용 네이밍 룰(WEB syntax)을 수립하며, Tokens Studio 파이프라인을 통해 변경 사항을 안전하게 마이그레이션합니다.

---

## [sort1] 7. 마치며

이번 디자인 시스템은 '완벽한 추상화와 중앙 통제'라는 전통적인 디자인 시스템의 미덕을 과감히 내려놓았습니다. 대신, **속도, 프로젝트별 소유권, 그리고 유연한 커스터마이징**이라는 마이크로 SaaS 생태계에 더 현실적인 무기를 쥐기로 했습니다.

이 기획과 고민의 결과물이 앞으로 탄생할 수많은 프로젝트들의 든든하고 유연한 베이스캠프가 되기를 기대합니다.
