# 기술 블로그

## Goal

Markdown 글은 Next.js App Router로 정적 생성하고, Vercel에서 페이지와 API를 배포한다.

이 문서에서 **정적 생성**은 Next.js가 빌드 시점에 HTML을 미리 생성하는 Static Site Generation(SSG)을 뜻한다. 공개 글 페이지의 기본 렌더링 전략은 배포 환경에서도 SSG로 유지된다.

## Prerequisites

- Node.js 22 계열
- pnpm
- GitHub 저장소와 연결된 Vercel 프로젝트
- 배포 도메인을 나타내는 `NEXT_PUBLIC_SITE_URL`

로컬 개발에서는 `NEXT_PUBLIC_SITE_URL`이 없어도 `http://localhost:3000`을 사용한다. 배포 환경에서는 canonical URL, sitemap, RSS, Open Graph URL이 실제 도메인을 가리키도록 반드시 설정한다.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com
```

## Step-by-Step Guide

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000`을 연다.

### 3. 글 작성

`content/posts` 디렉터리에 Markdown 파일을 추가한다.

```md
---
title: 'Next.js 정적 생성 적용기'
description: '정적 생성이 블로그 SEO에 주는 이점을 정리합니다.'
date: '2026-07-06'
tags:
  - nextjs
  - seo
visibility: public
---

본문을 작성합니다.
```

공개 글은 `description`과 최소 1개 이상의 `tags`가 필요하다. `draft: true`인 글은 공개 목록, sitemap, RSS에서 제외된다.
Google 인증 사용자에게만 공개하려면 `visibility: authenticated`를 사용한다. 설정 방법은
[Google OAuth 비공개 글 설정](./docs/google-oauth-private-posts-setup.md)을 참고한다.

### 4. 정적 생성 결과 확인

```bash
pnpm build
```

빌드 결과에서 다음 표시를 확인한다.

```text
○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
```

`/posts/[slug]`와 `/tags/[tag]`가 `SSG`로 표시되면 글 상세와 태그 페이지가 빌드 시점에 생성된 것이다.

### 5. production 서버 실행

빌드가 끝난 후 production 서버를 실행한다.

```bash
pnpm start
```

브라우저에서 `http://localhost:3000`을 열고 글 목록, 글 상세, 태그 페이지를 확인한다.

### 6. Vercel 배포

1. Vercel Dashboard에서 GitHub 저장소를 가져온다.
2. Framework Preset이 `Next.js`인지 확인한다.
3. Production Branch를 `main`으로 설정한다.
4. Production 환경 변수에 실제 운영 주소를 등록한다.

```dotenv
NEXT_PUBLIC_SITE_URL=https://example.com
```

5. 첫 배포를 실행한다.

연결 후 Pull Request에는 Preview Deployment가 생성되고, `main` 갱신에는 Production Deployment가 생성된다. Preview 환경에 `NEXT_PUBLIC_SITE_URL`이 없으면 애플리케이션은 Vercel이 제공하는 `VERCEL_URL`을 사용한다.

## SEO 구조

글 상세 페이지와 태그 페이지는 `generateStaticParams()`로 빌드 시점에 생성할 경로를 제공한다. `dynamicParams = false`는 이 목록에 없는 동적 경로가 요청될 때 새 페이지를 요청 시점에 만들지 않고 404를 반환하게 한다.

별도의 `dynamic = 'error'` 설정은 사용하지 않는다. 현재 구조에서는 이미 `generateStaticParams()`와 파일 기반 데이터 조회만으로 정적 생성이 가능하기 때문이다. 이 설정은 정적 생성 전제를 강하게 고정해야 할 때만 추가로 검토한다.

검색엔진 관점에서 이 구조가 유리한 이유는 다음과 같다.

- 글 본문이 초기 HTML에 포함되어 JavaScript 실행 전에도 내용을 읽을 수 있다.
- 페이지별 `title`, `description`, canonical URL이 생성된다.
- sitemap이 공개 URL 발견을 돕는다.
- RSS feed가 최신 글 구독과 외부 수집 경로를 제공한다.
- `BlogPosting` JSON-LD가 글 제목, 발행일, 작성자, 태그를 구조화된 데이터로 전달한다.

정적 생성은 검색 순위 상승의 충분조건이 아니다. 다만 크롤링 안정성, 색인 가능성, 메타데이터 전달, 초기 응답 성능 측면에서 SEO에 필요한 조건을 더 안정적으로 만족하게 한다.

## Verification

작업 전후에는 다음 명령을 실행한다.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
