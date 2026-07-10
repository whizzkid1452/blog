# Next.js 적용 구조와 선택 근거 분석

## Goal

이 프로젝트가 Next.js를 어떤 역할에 사용하고 있는지 설명하고, App Router, React Server Components, Static Site Generation(SSG), Markdown 콘텐츠 파이프라인, 검색엔진 최적화(Search Engine Optimization, SEO), 정적 export, AWS Amplify Hosting을 선택한 근거와 트레이드오프를 정리한다.

이 문서는 사용 중인 기능을 나열하는 데서 끝나지 않는다. 각 선택이 현재 요구사항에서 어떤 문제를 해결하는지, 어떤 조건이 바뀌면 결정을 다시 검토해야 하는지를 함께 설명한다.

## 핵심 결론

이 프로젝트에서 Next.js의 주된 역할은 **요청마다 HTML을 만드는 서버 프레임워크**가 아니다. 현재 역할은 다음 세 가지다.

1. 파일 시스템 기반 App Router로 페이지와 메타데이터 경로를 구조화한다.
2. Markdown 콘텐츠를 빌드 시점에 읽어 HTML, RSS, sitemap, robots, Open Graph 이미지로 변환한다.
3. 생성된 결과를 `out` 디렉터리로 export해 서버 프로세스 없이 배포한다.

따라서 현재 구조를 정확히 표현하면 다음과 같다.

> App Router와 React Server Components를 사용하지만, 공개 결과물은 요청 시점 서버 렌더링이 아니라 빌드 시점 SSG와 정적 export로 생성한다.

React Server Component를 사용한다는 사실은 운영 환경에 Node.js 서버가 필요하다는 뜻이 아니다. 이 프로젝트에서는 Server Component가 주로 빌드 과정에서 실행되고, 결과가 정적 HTML과 React Server Component payload로 기록된다.

## 용어 정의

- **App Router**: `app` 디렉터리의 파일 구조로 route, layout, metadata, Route Handler를 정의하는 Next.js 라우팅 체계
- **React Server Component**: 기본적으로 서버 또는 빌드 환경에서 실행되며 브라우저 JavaScript가 필요하지 않은 React 컴포넌트
- **Client Component**: `'use client'` 경계 아래에서 브라우저 상태, event handler, Web API를 사용할 수 있는 React 컴포넌트
- **SSG**: 빌드 시점에 route별 HTML을 생성하는 방식
- **정적 export**: Next.js 빌드 결과를 정적 파일 집합인 `out` 디렉터리로 출력하는 기능
- **정적 호스팅**: 정적 파일을 상시 실행 애플리케이션 서버 없이 저장소와 Content Delivery Network(CDN)에서 전달하는 방식
- **SSR**: 사용자 요청 시점마다 서버가 HTML을 생성하는 방식
- **ISR**: 정적 페이지를 제공하면서 배포 후 정해진 조건에 따라 페이지를 다시 생성하는 방식

SSG와 정적 호스팅은 같은 개념이 아니다. SSG는 **HTML 생성 시점**에 관한 선택이고, 정적 호스팅은 **생성된 파일의 전달 방식**에 관한 선택이다. 이 프로젝트는 두 방식을 함께 사용한다.

## 분석의 근거 수준

### 확인된 사실

- Next.js `16.2.9`와 App Router를 사용한다.
- 공개 콘텐츠는 `content/posts`의 `.md` 파일에 저장된다.
- `gray-matter`가 frontmatter와 본문을 분리하고 Zod가 frontmatter를 검증한다.
- 페이지와 layout은 기본적으로 Server Component다.
- 브라우저 상호작용이 필요한 다섯 개 컴포넌트만 명시적인 Client Component다.
- 글과 태그 route는 `generateStaticParams()`와 `dynamicParams = false`를 사용한다.
- `next.config.ts`는 `output: 'export'`를 사용한다.
- `pnpm build`는 현재 80개 route를 정적으로 생성하고 `out` 디렉터리를 만든다.
- AWS 배포는 `amplify.yml`이 `out` 디렉터리를 Amplify Hosting에 전달하도록 구성되어 있다.

### 코드에서 도출한 추론

- Next.js를 선택한 핵심 가치는 SSR 자체보다 route, metadata, 정적 생성, 이미지 생성, 배포 산출물을 하나의 빌드 그래프로 묶는 데 있다.
- Markdown을 MDX로 실행하지 않는 현재 방식은 콘텐츠 안에서 임의의 React 컴포넌트를 실행하는 복잡도를 피하려는 구조와 일치한다.
- 공개 페이지가 사용자별 상태나 요청 헤더에 의존하지 않으므로 SSR보다 SSG가 현재 요구사항에 더 적합하다.
- 상시 서버를 전제로 한 ECS 구조보다 정적 호스팅이 현재 기능과 비용 제약에 더 잘 맞는다.

### 아직 확인되지 않은 가정

- 글 수가 현재 규모에서 급격히 증가하지 않는다.
- 글 수정 후 Git push와 재배포를 거치는 흐름이 운영 요구사항을 만족한다.
- 로그인, 댓글 저장, 관리자 편집기처럼 요청 시점의 서버 상태가 필요한 기능은 당장 필요하지 않다.
- 실제 검색 유입과 Core Web Vitals 개선 여부는 배포 후 측정해야 한다.

## 1. 왜 Next.js를 사용했는가

### 문제

이 블로그에는 단순히 React 화면을 렌더링하는 것 외에도 다음 결과물이 필요하다.

- 글 목록, 글 상세, 태그별 목록 route
- route별 title, description, canonical URL
- Open Graph와 Twitter metadata
- `BlogPosting`, `BreadcrumbList`, `WebSite`, `Person` JSON-LD
- `sitemap.xml`, `robots.txt`, `feed.xml`
- 글별 Open Graph 이미지
- 정적 HTML과 브라우저 상호작용 코드

React 단독 Single Page Application(SPA)으로도 일부 기능을 구현할 수 있지만, route별 초기 HTML과 metadata를 별도 도구 없이 일관되게 생성하려면 추가 구성이 필요하다.

### 선택

Next.js를 페이지 라우팅과 빌드 오케스트레이션 계층으로 사용한다.

App Router의 route 규칙과 Metadata API를 사용하면 페이지, metadata, sitemap, robots, Route Handler, Open Graph 이미지 생성이 동일한 route 구조 안에 놓인다. 이 구조는 URL과 SEO 산출물 사이의 불일치를 줄이는 데 유리하다.

### 선택의 한계

현재 블로그 규모만 보면 더 작은 정적 사이트 생성기도 충분할 수 있다. 따라서 Next.js가 유일한 해법이라는 결론은 성립하지 않는다. 이 프로젝트에서 Next.js를 유지할 근거는 다음 기능을 한 코드베이스에서 학습하고 검증하려는 목적까지 포함할 때 강해진다.

- React 기반 UI
- route 단위 metadata
- Server Component와 Client Component 경계
- 정적 생성과 정적 export
- 향후 일부 route의 동적 전환 가능성

## 2. App Router를 어떻게 적용했는가

### 공통 layout

[`app/layout.tsx`](../app/layout.tsx)는 모든 페이지가 공유하는 root layout이다. 전역 metadata와 사이트 JSON-LD를 만들고 `SiteLayoutContainer`를 통해 navigation, tag, 최근 글 데이터를 공통 UI에 전달한다.

```text
app/layout.tsx
  └─ SiteLayoutContainer
      └─ SiteLayout
          └─ route page
```

공통 shell을 route별 페이지에서 반복하지 않으므로 layout 책임과 페이지별 콘텐츠 책임이 분리된다.

### 정적 route

- `/`: 최신 공개 글 목록
- `/posts`: 전체 공개 글 목록
- `/feed.xml`: RSS
- `/sitemap.xml`: 공개 페이지 목록
- `/robots.txt`: 크롤러 규칙과 sitemap 위치

### 동적 segment이지만 정적으로 생성되는 route

- `/posts/[slug]`
- `/tags/[tag]`
- `/posts/[slug]/opengraph-image`

여기서 **동적 segment**는 URL 패턴에 변수가 있다는 뜻이다. 요청 시점에 동적으로 렌더링한다는 뜻은 아니다. `generateStaticParams()`가 slug와 tag 목록을 빌드 시점에 제공하므로 실제 결과는 SSG다.

```ts
export function generateStaticParams() {
  return getPostIndex()
    .getPostSummaries()
    .map(post => ({ slug: post.slug }));
}

export const dynamicParams = false;
```

`dynamicParams = false`는 빌드 목록에 없는 slug를 요청 시점에 새로 렌더링하지 않는다는 제약이다. 정적 호스팅 환경에서는 이 제약이 실제 산출물과 공개 URL 집합을 일치시킨다.

## 3. Server Component 중심 구조를 선택한 이유

### 현재 경계

페이지, layout, Markdown 파일 읽기, 글 정렬, 관련 글 계산, metadata와 JSON-LD 생성은 Server Component 또는 일반 서버 전용 모듈에서 처리한다.

Client Component는 브라우저 기능이 필요한 다음 영역으로 제한한다.

- 모바일 navigation dialog
- 현재 route에 따른 navigation 활성 상태
- sidebar collapse 상태
- 코드 복사와 toast/tooltip
- Mermaid diagram의 브라우저 렌더링과 색상 모드 감지

### 선택 근거

글 본문과 목록은 브라우저 상태가 없어도 렌더링할 수 있다. 이 영역까지 Client Component로 만들면 콘텐츠 데이터와 렌더링 코드가 브라우저 bundle 경계로 이동할 수 있다.

반대로 clipboard, `window.matchMedia`, dialog open state, `usePathname()`은 브라우저 실행이 필요하다. 따라서 해당 기능만 `'use client'` 경계로 분리했다.

```text
Build-time Server Component
  ├─ 글 읽기와 검증
  ├─ HTML과 metadata 생성
  └─ 정적 props 전달
       ↓
Client islands
  ├─ dialog/collapsible
  ├─ clipboard feedback
  └─ Mermaid rendering
```

### 중요한 구분

이 구조를 “서버 렌더링”이라고만 부르면 부정확하다. Server Component의 **실행 위치**와 HTML의 **생성 시점**은 별도 축이다.

- 실행 위치: Server Component
- 생성 시점: 빌드 시점
- 배포 결과: 정적 파일
- 요청 시점 Node.js 프로세스: 없음

## 4. Markdown 콘텐츠 파이프라인

### MDX가 아니라 Markdown이다

초기 [`docs/spec.md`](./spec.md)에는 MDX라고 기록되어 있었지만 현재 구현은 MDX가 아니다. 이번 분석에서 spec을 실제 구현에 맞게 정정했다. 실제 입력은 `.md` 파일이며, [`lib/posts.ts`](../lib/posts.ts)가 `gray-matter`로 frontmatter를 읽고 [`components/markdown-content.tsx`](../components/markdown-content.tsx)가 `react-markdown`으로 본문을 렌더링한다.

이 차이는 중요하다.

- Markdown: 문서 데이터를 파싱해 허용된 renderer로 변환한다.
- MDX: Markdown 안에서 JSX와 React 컴포넌트를 실행할 수 있다.

현재 구조에서는 글 작성자가 본문 안에서 임의의 React 컴포넌트를 직접 실행하지 않는다.

### 처리 흐름

```text
content/posts/*.md
  ↓ fs.readFileSync
gray-matter
  ├─ frontmatter → Zod validation
  └─ Markdown body → SEO validation
  ↓
PostIndex
  ├─ draft 제외
  ├─ 최신순 정렬
  ├─ tag index
  └─ 관련 글 계산
  ↓
App Router pages / metadata / RSS / sitemap
```

### frontmatter 검증을 빌드 경계에 둔 이유

공개 글에는 description과 최소 한 개의 tag가 필요하다. cover image와 cover alt도 함께 존재해야 한다. 이 규칙은 페이지 렌더링 중 조용히 기본값을 적용하는 대신 Zod schema에서 검증한다.

잘못된 글은 배포 후 일부 페이지에서 깨지는 대신 빌드 단계에서 실패한다. 정적 사이트에서는 빌드가 콘텐츠 데이터의 검증 경계 역할도 담당한다.

### `PostIndex`를 둔 이유

파일 읽기와 UI 렌더링 사이에 [`PostIndex`](../lib/post-index.ts)를 둬 다음 규칙을 한곳에 모았다.

- draft 제외
- 발행 시각과 slug를 기준으로 한 결정적 정렬
- tag별 조회
- 공유 tag 수를 기준으로 한 관련 글 선택

`getPostIndex()`의 module-level cache는 현재 정적 빌드 프로세스 안에서 중복 파일 읽기와 index 계산을 줄이는 process-local memoization이다. 분산 cache나 요청 간 영속 cache를 의미하지 않는다.

### 선택의 트레이드오프

장점:

- 콘텐츠 변경 이력이 Git commit에 남는다.
- DB, migration, credential, network가 필요하지 않다.
- 빌드 결과를 같은 입력으로 재현하기 쉽다.
- 콘텐츠 schema와 내부 링크를 배포 전에 검사할 수 있다.

제약:

- 글 변경마다 새 빌드가 필요하다.
- 웹 관리자 화면에서 즉시 글을 수정하는 흐름과 맞지 않는다.
- 글 수가 크게 증가하면 파일 읽기와 전체 route 생성 시간이 늘어난다.

## 5. Markdown 렌더링에서 Next.js를 활용한 방식

[`MarkdownContent`](../components/markdown-content.tsx)는 `react-markdown` 위에 프로젝트 규칙을 추가한다.

- `remark-gfm`: GitHub Flavored Markdown 지원
- `rehype-pretty-code`: 빌드 시점 syntax highlighting
- 내부 링크: `next/link` 사용
- 외부 HTTP(S) 링크: 새 창과 `noopener noreferrer` 적용
- 로컬 이미지: 실제 파일 크기를 읽어 width와 height 지정
- Mermaid code fence: Client Component로 전달해 브라우저에서 렌더링
- 일반 code fence: 복사 버튼과 결과 toast 제공

### 이미지 최적화 선택

정적 export에는 Next.js 이미지 최적화 서버가 존재하지 않는다. 따라서 [`next.config.ts`](../next.config.ts)는 다음 설정을 사용한다.

```ts
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};
```

`unoptimized: true`는 이미지 크기 정보까지 제거한다는 뜻이 아니다. 로컬 이미지는 빌드 중 `image-size`로 width와 height를 읽어 layout shift 위험을 줄이지만, 요청 시점의 형식 변환이나 resize는 수행하지 않는다.

## 6. SEO를 route 생성 과정에 포함한 이유

SEO 정보는 페이지 렌더링 이후 별도 스크립트로 덧붙이지 않는다. App Router의 Metadata API와 metadata route를 사용해 route 생성 과정에 포함한다.

### 페이지 metadata

[`lib/seo-metadata.ts`](../lib/seo-metadata.ts)는 다음 값을 route별로 만든다.

- title과 description
- canonical URL
- Open Graph article/website metadata
- Twitter card metadata
- 발행 시각, 작성자, tag

### 구조화 데이터

[`lib/structured-data.ts`](../lib/structured-data.ts)는 다음 JSON-LD를 생성한다.

- 사이트: `WebSite`, `Person`
- 글: `BlogPosting`
- breadcrumb: `BreadcrumbList`

`JSON.stringify()` 결과의 `<` 문자를 Unicode escape로 바꿔 script 문맥에서 HTML 종료 문자열로 해석될 위험을 줄인다.

### 발견 경로

- `sitemap.xml`: 검색엔진이 공개 URL 집합을 찾는 경로
- `robots.txt`: crawler rule과 sitemap 위치
- `feed.xml`: RSS reader와 외부 수집기의 최신 글 발견 경로
- Open Graph 이미지: 소셜 공유 문맥의 대표 이미지

이 구현은 검색 순위 상승의 원인이라고 단정할 수 없다. 직접 보장하는 것은 초기 HTML과 보조 문서에 일관된 URL 및 콘텐츠 정보를 포함하는 것이다. 실제 검색 유입은 배포 후 측정 대상이다.

## 7. SSG에서 정적 export로 확장한 이유

### 이전 상태

이전 구성도 글 페이지를 SSG로 생성했지만 배포 단위는 다음과 같았다.

```text
Docker image
  ↓
ECS/Fargate container
  ↓
Next.js Node.js server
  ↓
Application Load Balancer
```

SSG 결과를 만들면서도 그 파일을 전달하기 위해 Node.js 프로세스와 Load Balancer를 상시 실행하는 구조였다. 향후 RDS와 서버 운영을 학습하려는 계획에는 맞지만, 현재 공개 기능의 필요조건은 아니었다.

### 현재 상태

```text
GitHub main
  ↓
Amplify build
  ↓ pnpm build
out/*
  ↓
Amplify Hosting CDN
```

### 변경 내용

- `output: 'standalone'`을 `output: 'export'`로 변경
- 정적 export에서 사용할 수 없는 `/api/health` 제거
- 서버 배포 산출물인 Dockerfile 제거
- 이미지 최적화 서버를 전제로 하지 않도록 `images.unoptimized` 설정
- Next.js 16 정적 export가 요구하는 `robots.txt`와 `sitemap.xml`의 `force-static` 선언 추가
- 정적 export 계약 테스트 추가
- Amplify가 `out`을 배포하도록 build specification 추가

### health endpoint를 제거한 이유

health endpoint는 애플리케이션 프로세스가 요청을 처리할 수 있는지 확인하는 경로다. 정적 호스팅에는 해당 프로세스가 없으므로 `/api/health`는 확인할 대상과 일치하지 않는다.

정적 배포의 검증 대상은 다음으로 바뀐다.

- Amplify deployment status
- 공개 URL의 HTTP 응답
- 핵심 정적 산출물 존재 여부

## 8. 왜 Amplify Hosting을 선택했는가

### 선택 근거

현재 저장소는 GitHub의 `main` 브랜치를 운영 기준으로 사용한다. Amplify Hosting은 Git push, build, CDN 배포, HTTPS 기본 도메인을 하나의 관리 흐름으로 연결한다.

[`amplify.yml`](../amplify.yml)은 다음 계약을 명시한다.

```yaml
build:
  commands:
    - pnpm build
artifacts:
  baseDirectory: out
```

커스텀 `NEXT_PUBLIC_SITE_URL`이 없을 때는 Amplify가 제공하는 `AWS_BRANCH`와 `AWS_APP_ID`로 기본 도메인을 계산한다. 커스텀 도메인을 연결하면 명시적인 `NEXT_PUBLIC_SITE_URL`이 우선한다.

### Next.js 16 SSR 지원 범위가 차단 조건이 아닌 이유

Amplify의 SSR compute가 특정 Next.js 버전을 지원하는지와 정적 파일을 호스팅할 수 있는지는 다른 문제다. 현재 배포는 Amplify에서 Next.js 서버를 실행하지 않고 `out`의 파일을 정적 asset으로 배포한다.

따라서 이 구조에서 필요한 호환성 조건은 다음이다.

1. Amplify build image가 Node.js 22와 pnpm을 실행할 수 있다.
2. `pnpm build`가 `out`을 생성한다.
3. Amplify가 `out`을 정적 artifact로 배포한다.

### 대안 비교

| 선택지                    | 현재 장점                                     | 현재 비용·복잡도                                                       | 판단                                |
| ------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| CSR SPA                   | 단순한 client 배포                            | 초기 HTML의 글 본문과 route metadata 구성이 약해질 수 있음             | 공개 글 기본 전략으로 선택하지 않음 |
| SSR + ECS/Fargate         | 요청별 데이터, RDS, 서버 API 확장에 적합      | container, load balancer, health check, logging 운영 필요              | 현재 요구사항에는 과함              |
| S3 + CloudFront 직접 구성 | 세부 cache와 origin 정책을 직접 통제 가능     | bucket policy, origin access, clean URL, invalidation 구성을 직접 관리 | 필요 시 향후 검토                   |
| Amplify 정적 호스팅       | Git 기반 build와 CDN/HTTPS를 한 흐름으로 제공 | Amplify 종량제와 서비스 설정에 의존                                    | 현재 선택                           |
| Vercel                    | Next.js 배포 통합이 강함                      | 현재 AWS 배포 학습·비용 관리 목표와 다른 플랫폼                        | 현재 범위에서 제외                  |

이 비교는 Amplify가 항상 가장 저렴하거나 모든 상황에서 우월하다는 의미가 아니다. 현재 판단은 낮은 트래픽의 파일 기반 블로그, AWS 사용, 운영 단순화라는 조건에 한정된다.

## 9. 테스트와 빌드를 아키텍처 검증으로 사용한 방식

정적 호스팅 전환은 설정 문자열만 바꾸는 작업이 아니다. 동적 route, image optimization, metadata route 중 하나라도 요청 시점 서버에 의존하면 export가 실패할 수 있다.

검증은 다음 계층으로 나뉜다.

### 단위 테스트

- frontmatter schema와 날짜 경계
- draft 제외, 정렬, tag와 관련 글 계산
- metadata와 JSON-LD 생성
- RSS와 sitemap
- Markdown 내부 링크와 이미지 alt 검증
- `next.config.ts`의 export 계약
- `amplify.yml`의 build와 artifact 계약

### 통합 검증

`pnpm build`는 다음 조건을 함께 검증한다.

- 모든 공개 slug와 tag가 정적으로 생성되는가
- metadata route가 export 가능한가
- Open Graph 이미지가 생성되는가
- 브라우저 bundle과 Server Component build가 성공하는가
- 최종 `out` 산출물이 생성되는가

현재 검증 결과는 43개 테스트와 80개 정적 route 통과다. 이는 배포 성공의 필요조건 일부를 확인하지만, 실제 Amplify 네트워크 응답과 검색엔진 색인을 보장하지는 않는다.

## 10. 결정을 다시 검토해야 하는 조건

### CMS 또는 DB 도입

글 변경과 애플리케이션 배포를 분리해야 한다면 전체 재빌드가 운영 요구사항을 만족하는지 다시 평가해야 한다. 선택지는 webhook 기반 재배포, 별도 API, SSR, ISR 등이 될 수 있다.

### 사용자별 콘텐츠

로그인 사용자별 초안, 권한, 개인화 콘텐츠가 필요하면 해당 route는 정적 HTML만으로 완결되지 않는다. 이때도 전체 사이트를 SSR로 바꾸기보다 필요한 route의 실행 조건을 먼저 분리해야 한다.

### 요청 시점 쓰기 기능

댓글, 조회수, 검색 기록처럼 쓰기가 필요한 기능은 외부 API나 서버 실행 계층이 필요하다. 정적 페이지는 그대로 유지하고 쓰기 기능만 별도 서비스로 분리할 수도 있다.

### 빌드 시간 증가

글과 tag 조합이 크게 늘어나 빌드 시간이 운영 병목이 되면 전체 SSG의 비용을 측정해야 한다. 그 시점에 incremental build, ISR, 콘텐츠 분할을 비교한다.

### 이미지 처리 요구 증가

현재 이미지는 원본 파일을 그대로 전달한다. 여러 화면 크기와 형식에 맞춘 변환 비용이 실제 성능 병목으로 확인되면 image CDN 또는 build-time image pipeline을 검토한다.

## 최종 판단

현재 Next.js 적용의 중심 원칙은 다음과 같다.

> 요청 시점 기능이 필요한 영역만 브라우저나 서버 실행 경계로 보내고, 나머지 공개 콘텐츠는 빌드 시점에 확정한다.

이 원칙에 따라:

- App Router는 URL과 metadata 구조를 관리한다.
- Server Component는 콘텐츠 읽기와 정적 HTML 생성을 담당한다.
- Client Component는 실제 브라우저 상호작용만 담당한다.
- Markdown과 `PostIndex`는 콘텐츠 저장과 조회 규칙을 담당한다.
- Metadata API와 metadata route는 SEO 산출물을 route와 함께 생성한다.
- 정적 export는 Node.js runtime 의존성을 제거한다.
- Amplify Hosting은 Git에서 CDN까지의 배포 흐름을 담당한다.

이 설계의 가치는 Next.js 기능을 많이 사용했다는 데 있지 않다. **현재 요구사항에 필요하지 않은 요청 시점 서버를 제거하면서도, route·SEO·React 상호작용·향후 확장 경계를 유지했다는 데 있다.**

## Verification

다음 명령으로 문서에 기술한 현재 전제를 확인한다.

```bash
pnpm test
pnpm typecheck
pnpm lint
NEXT_PUBLIC_SITE_URL=https://example.com pnpm build
```

검증 결과에서 확인할 항목:

- `/posts/[slug]`와 `/tags/[tag]`가 `SSG`로 표시된다.
- 모든 공개 글의 Open Graph 이미지가 생성된다.
- `out/index.html`, `out/posts.html`, `out/feed.xml`, `out/sitemap.xml`, `out/robots.txt`가 존재한다.
- `next.config.ts`에 `output: 'export'`가 유지된다.
- `amplify.yml`의 artifact directory가 `out`이다.

## Related Documents

- [블로그 SEO를 위한 정적 생성 선택 기록](./static-generation-seo-decision.md)
- [AWS Amplify 정적 호스팅 배포](./aws-deployment-plan.md)
- [프로젝트 실행과 글 작성 가이드](../README.md)

## References

- [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [AWS Amplify environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [AWS Amplify clean URLs](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html#trailing-slashes-and-clean-urls)
