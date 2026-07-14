# Google OAuth 비공개 글 설정

## Goal

Supabase Auth에 Google OAuth를 연결하고, Google로 인증된 사용자만 `visibility: authenticated` 글을 볼 수 있게 설정한다.

현재 권한 정책은 특정 사용자만 허용하는 방식이 아니다. Google 인증에 성공한 모든 사용자를 허용한다.

## Prerequisites

- Google Cloud 프로젝트
- Supabase 프로젝트
- 로컬 개발 주소와 운영 도메인

## Step-by-Step Guide

### 1. Google OAuth 클라이언트 만들기

Google Auth Platform에서 OAuth 클라이언트 유형을 `Web application`으로 만든다.

Authorized JavaScript origins에 다음 주소를 등록한다.

```text
http://localhost:3000
https://blog.example.com
```

Authorized redirect URIs에는 애플리케이션의 `/auth/callback`이 아니라 Supabase Dashboard의 Google Provider 화면에 표시되는 callback URL을 등록한다.

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Google Data Access에는 `openid`, `userinfo.email`, `userinfo.profile` scope가 필요하다.

### 2. Supabase에서 Google Provider 활성화하기

Supabase Dashboard의 Authentication Providers에서 Google을 활성화하고 Google Client ID와 Client Secret을 입력한다.

Authentication URL Configuration에는 다음 값을 등록한다.

```text
Site URL: https://blog.example.com
Redirect URLs:
http://localhost:3000/auth/callback
https://blog.example.com/auth/callback
```

운영 도메인이 다르면 실제 도메인으로 바꾼다.

### 3. 환경 변수 설정하기

`.env.example`을 `.env.local`로 복사하고 공개 사이트 URL을 입력한다.

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Supabase 프로젝트 URL과 Publishable key는
[`environment.ts`](../lib/supabase/environment.ts)에 공개 상수로 저장되어 있다. 운영 환경의 `NEXT_PUBLIC_SITE_URL`에는
HTTPS 운영 주소를 입력한다. Google Client Secret은 애플리케이션 환경 변수나 저장소에 넣지 않고 Supabase Provider
설정에만 저장한다.

### 4. 비공개 글 표시하기

글의 frontmatter에 `visibility: authenticated`를 추가한다.

```md
---
title: '인증 사용자 전용 글'
description: 'Google 인증 사용자에게만 제공하는 글입니다.'
date: '2026-07-14'
tags: ['private']
draft: false
visibility: authenticated
---

본문을 작성합니다.
```

`draft: true`이면 인증 여부와 관계없이 글 목록과 상세 페이지에서 제외된다.

### Verify Final Result

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

브라우저에서 다음 동작을 확인한다.

1. 로그아웃 상태로 `/private-posts`에 접근하면 Google 로그인으로 이동한다.
2. 로그인 후 비공개 글 목록과 상세 페이지가 열린다.
3. 비공개 글은 일반 글 목록, `/feed.xml`, `/sitemap.xml`에 나타나지 않는다.
4. 로그아웃 후 비공개 글 상세 주소에 다시 접근하면 Google 로그인으로 이동한다.

공식 설정 기준은 [Supabase Google 로그인 문서](https://supabase.com/docs/guides/auth/social-login/auth-google)와 [Supabase Next.js 서버 인증 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)를 따른다.
