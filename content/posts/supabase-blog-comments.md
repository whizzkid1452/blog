---
title: 'Supabase로 블로그 댓글 기능 구현하기'
description: 'Next.js 블로그에 Supabase 댓글 저장소, API Route, RLS 정책과 댓글 UI를 연결한 과정을 정리합니다.'
date: '2026-07-14'
tags: ['nextjs', 'supabase', 'postgresql', 'security']
draft: true
---

정적 Markdown 글만 제공하던 블로그에 댓글 기능을 추가했다. 글은 파일로 관리할 수 있지만, 방문자가 작성하는 댓글은 요청이 끝난 뒤에도 남아 있어야 한다. 그래서 이번 작업에서는 Supabase의 PostgreSQL을 영구 저장소로 사용했다.

처음에는 화면에서 Supabase를 바로 호출하는 구조도 생각했다. 구현은 짧아지지만 입력 검증, 글 존재 여부 확인, 오류 응답 형식이 UI에 섞인다. 결국 Next.js API Route를 중간에 두고, 데이터 접근은 Repository로 분리했다.

> 댓글 기능의 핵심은 입력 폼이 아니라 권한 경계를 어디에 둘지 결정하는 일이었다.

## 1. 왜 API Route와 Repository를 분리했는가

이번에 구성한 요청 흐름은 다음과 같다.

```text
CommentsSection
  → /api/posts/[slug]/comments
  → CommentRepository
  → Supabase PostgreSQL
```

각 구성 요소의 책임을 다음처럼 나눴다.

- `CommentsSection`: 입력값과 로딩·오류·빈 목록 상태를 화면에 표시한다.
- API Route: 글과 요청값을 검증하고 HTTP 상태 코드를 결정한다.
- `CommentRepository`: Supabase의 행 구조를 애플리케이션의 `BlogComment` 타입으로 변환한다.
- PostgreSQL: 제약 조건과 Row Level Security(RLS) 정책을 적용한다.

여기서 Repository는 데이터 저장소에 접근하는 인터페이스다. API Route는 Supabase 쿼리 작성법을 알 필요가 없고, 테스트에서는 실제 데이터베이스 대신 Stub을 주입할 수 있다.

## 2. 어떻게 댓글 테이블과 권한을 설계했는가

댓글은 글의 slug, 닉네임, 본문, 작성 시각을 저장한다. 현재 구조에는 글 정보를 저장하는 테이블이 없으므로 Markdown 파일을 외래 키 대상으로 직접 참조할 수 없다. 대신 API Route에서 실제 공개 글인지 확인한 뒤 댓글 저장소를 호출한다.

```sql
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint comments_author_name_length_check check (
    char_length(author_name) between 1 and 40
    and author_name = btrim(author_name)
  ),
  constraint comments_content_length_check check (
    char_length(content) between 1 and 1000
    and content = btrim(content)
  )
);

create index comments_post_slug_created_at_idx
on public.comments (post_slug, created_at, id);
```

길이 제한은 UI와 API에만 두지 않고 데이터베이스에도 뒀다. 다른 경로에서 테이블에 접근하더라도 빈 문자열이나 제한을 넘는 값이 저장되지 않게 하기 위해서다. 공백 제거 여부도 `btrim`과 원본 값을 비교해 검사한다.

공개 댓글은 로그인 없이 읽고 쓸 수 있어야 했다. 대신 수정과 삭제는 허용하지 않았다.

```sql
alter table public.comments enable row level security;

revoke all on table public.comments from anon, authenticated;
grant select, insert on table public.comments to anon;

create policy "Public comments are readable"
on public.comments
for select
to anon
using (true);

create policy "Public comments are writable"
on public.comments
for insert
to anon
with check (true);
```

PostgreSQL의 테이블 권한과 RLS 정책은 서로 다른 검사다. `GRANT INSERT`만으로는 RLS를 통과할 수 없고, RLS 정책만 만들어도 테이블 수준의 `INSERT` 권한이 생기지 않는다. 이 구조에서는 두 조건을 모두 만족한 `anon` 역할만 `SELECT`, `INSERT`를 실행할 수 있다.

Supabase publishable key는 비밀 관리자 키가 아니다. 따라서 key 자체를 권한 경계로 보면 안 된다. 이 구현에서 최종 데이터 접근 범위를 제한하는 장치는 PostgreSQL 권한과 RLS 정책이다.

## 3. 왜 서버에서도 입력을 다시 검증했는가

HTML의 `required`, `maxLength`는 사용자 입력을 돕지만 서버 검증을 대신하지 않는다. HTTP 요청은 화면을 거치지 않고 직접 보낼 수 있기 때문이다.

API Route에서는 Zod schema로 다음 조건을 검사한다.

```ts
const createCommentSchema = z
  .object({
    authorName: z.string().trim().min(1).max(40),
    content: z.string().trim().min(1).max(1_000),
  })
  .strict();
```

검증 순서는 다음과 같다.

1. URL의 글 slug 형식을 확인한다.
2. slug에 해당하는 공개 글이 실제로 존재하는지 확인한다.
3. 쓰기 요청의 `Origin`이 현재 요청 URL의 origin과 다른 경우 `403`을 반환한다.
4. 닉네임과 댓글을 trim한 뒤 길이를 검사한다.
5. Repository를 호출하고 성공하면 `201`을 반환한다.

`Origin` 비교는 브라우저의 다른 출처에서 전송되는 쓰기 요청을 거부한다. 하지만 사용자 인증, 요청 횟수 제한, 스팸 차단을 제공하지는 않는다. 비브라우저 클라이언트의 직접 요청까지 막는 장치로 볼 수도 없다.

저장소 오류의 상세 메시지는 응답에 포함하지 않았다. 서버 로그에는 원래 오류를 남기고, 사용자에게는 일반화된 `503` 메시지를 반환한다. 데이터베이스 내부 정보가 HTTP 응답으로 그대로 노출되는 범위를 줄이기 위한 선택이다.

## 4. 어떻게 댓글 UI를 연결했는가

댓글 UI는 게시글 하단에 배치했다. 화면이 열리면 `GET` 요청으로 댓글을 불러오고, 폼 제출 시 `POST` 요청을 보낸다.

```ts
const response = await fetch(`/api/posts/${encodeURIComponent(postSlug)}/comments`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ authorName, content }),
});
```

서버 응답도 신뢰하지 않고 Zod schema로 다시 확인한다. 응답 구조가 예상과 다르면 성공 화면을 표시하지 않는다. 등록에 성공하면 반환된 댓글을 현재 목록 뒤에 추가하고 댓글 본문만 비운다.

UI에는 다음 상태를 각각 분리했다.

- 댓글을 처음 불러오는 상태
- 댓글이 없는 상태
- 조회 실패와 다시 시도 상태
- 댓글 등록 중인 상태
- 댓글 등록 실패 상태

조회 요청에는 `AbortController`를 사용했다. 컴포넌트가 사라진 뒤 완료된 요청이 상태를 변경하지 않도록 하기 위해서다. 한국어와 영어 문구, 날짜 형식도 현재 locale에 따라 나눴다.

## 5. 구현 과정에서 무엇이 실패했는가

처음 publishable key로 조회했을 때 다음 오류가 반환됐다.

```text
PGRST205: Could not find the table 'public.comments' in the schema cache
```

이 시점에는 애플리케이션 코드와 환경 변수는 준비됐지만 원격 프로젝트에 migration이 적용되지 않았다. SQL Editor에서 `comments` 테이블, index, RLS 정책을 생성한 뒤 같은 조회가 성공했다.

이 오류는 이번 상황에서는 테이블 생성 누락과 일치했다. 실제로 migration 실행이 성공했고, 이후 같은 publishable key로 조회했을 때 오류가 사라졌기 때문이다.

## 6. 어떻게 최종 동작을 검증했는가

권한 검증 중 테스트 댓글을 남기고 싶지는 않았다. 그래서 SQL transaction 안에서 `anon` 역할로 댓글을 저장한 뒤 `ROLLBACK`했다.

```sql
begin;
set local role anon;

insert into public.comments (post_slug, author_name, content)
values ('first-post', '검증', '댓글 쓰기 권한 검증');

rollback;
```

`INSERT`가 성공했으므로 `anon` 역할의 테이블 권한과 RLS 정책이 쓰기를 허용한다는 사실을 확인했다. 이어서 같은 값을 조회한 결과는 0건이었다. 따라서 검증용 댓글은 저장소에 남지 않았다.

마지막으로 실제 환경을 다음 순서로 확인했다.

1. publishable key를 사용한 `comments` 조회 성공
2. `anon` 역할의 댓글 작성 성공 후 transaction rollback
3. 로컬 API `GET /api/posts/first-post/comments`가 `200`과 `{"comments":[]}` 반환
4. 전체 단위 테스트 66개 통과
5. TypeScript typecheck, ESLint, production build 통과

단위 테스트에서는 정상 조회·작성뿐 아니라 존재하지 않는 글, 잘못된 입력, 다른 origin의 쓰기 요청, 저장소 오류 응답도 각각 확인했다. 다만 이 결과는 테스트한 동작 경로가 기대대로 실행됐다는 근거이며, 스팸이나 대량 요청에 대한 안전성을 증명하지는 않는다.

## 7. 현재 구조에 남아 있는 한계

현재 댓글 기능은 작동하지만 운영에 필요한 기능이 모두 있는 것은 아니다.

- 로그인과 작성자 식별이 없어 닉네임의 실제 소유자를 확인할 수 없다.
- 요청 횟수 제한과 스팸 필터가 없다.
- 관리자용 숨김·삭제 기능이 없다.
- 댓글 조회는 작성 시각 오름차순 최대 100개로 제한된다.
- 수정과 삭제는 의도적으로 허용하지 않았다.

트래픽과 스팸이 실제 문제로 확인되면 rate limiting과 moderation을 먼저 추가할 생각이다. 댓글 수가 100개에 가까워지면 cursor pagination도 필요하다. 아직 발생하지 않은 병목을 추정해 복잡도를 먼저 늘리지는 않았다.

## 8. 이번 작업에서 배운 점

처음에는 댓글 입력창과 목록을 만드는 일이 작업의 중심이라고 생각했다. 실제로 더 많은 판단이 필요했던 부분은 API, 데이터베이스 권한, 검증 책임을 나누는 일이었다.

> 공개 key를 숨기는 것보다 공개 key로 무엇을 할 수 있는지 제한하는 것이 중요하다.

API Route는 입력 검증과 일관된 HTTP 응답을 제공한다. 그러나 데이터베이스 권한을 대신하지 않는다. 반대로 RLS만으로는 사용자에게 이해하기 쉬운 오류와 UI 상태를 만들기 어렵다. 두 경계를 분리하고 각각의 역할을 좁게 유지했을 때, 댓글 기능은 화면부터 저장소까지 검증 가능한 흐름이 되었다.
