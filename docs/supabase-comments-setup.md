# Supabase 댓글 설정

## Goal

글별 공개 댓글을 Supabase PostgreSQL에 저장하고 조회한다.

## Prerequisites

- Supabase 프로젝트
- 프로젝트 URL
- `sb_publishable_`로 시작하는 Publishable key

이 기능은 Supabase Auth 로그인을 사용하지 않는다. Publishable key로 접근한 요청에는 PostgreSQL의 `anon` 역할과
Row Level Security(RLS) 정책이 적용된다.

## Step-by-Step Guide

### 1. 댓글 테이블 생성

Supabase Dashboard의 SQL Editor에서
[`20260714061500_create_comments.sql`](../supabase/migrations/20260714061500_create_comments.sql)을 실행한다.

마이그레이션은 다음 권한만 부여한다.

- `anon`: `SELECT`, `INSERT`
- `authenticated`: 권한 없음
- `UPDATE`, `DELETE`: 권한 없음

테이블 제약 조건은 글 slug, 닉네임 1~~40자, 댓글 1~~1,000자를 검사한다.

### 2. 로컬 환경 변수 설정

`.env.example`을 `.env.local`로 복사하고 Supabase Dashboard의 Connect 화면에서 확인한 값을 입력한다.

```bash
cp .env.example .env.local
```

PowerShell에서는 다음 명령을 사용한다.

```powershell
Copy-Item .env.example .env.local
```

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

두 값은 서버의 댓글 API에서만 읽는다. `SUPABASE_SECRET_KEY`는 필요하지 않으며 사용하지 않는다.

### 3. 배포 환경 변수 설정

배포 서비스에도 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 같은 이름으로 추가한다.

### Verify Final Result

```bash
pnpm dev
```

글 상세 페이지에서 댓글을 등록한 뒤 새로고침한다. 등록한 댓글이 다시 표시되면 저장과 조회가 연결된 것이다.

Supabase SQL Editor에서는 다음 쿼리로 저장 결과를 확인할 수 있다.

```sql
select id, post_slug, author_name, content, created_at
from public.comments
order by created_at desc;
```

## 운영 시 주의사항

RLS는 행 접근 권한을 제한하지만 요청 빈도를 제한하지 않는다. 현재 구현에는 사용자 인증, CAPTCHA, IP 기반 rate
limit가 없다. 공개 배포 후 자동 등록이 관찰되면 별도의 요청 제한 수단을 추가해야 한다.
