# AWS 서버와 DB 배포 계획

## Goal

현재 파일 기반 Next.js 블로그를 AWS에 직접 배포하고, 이후 PostgreSQL 기반 데이터 저장 구조로 점진적으로 전환한다.

이 문서에서 "서버"는 별도 Express 서버가 아니라, Next.js 애플리케이션을 Node.js 런타임에서 실행하는 서버 프로세스를 뜻한다. 예를 들어 `next start` 또는 standalone Docker 이미지 안의 `server.js`가 여기에 해당한다.

## 현재 상태

### 확인된 사실

- 프로젝트는 Next.js App Router 기반 애플리케이션이다.
- `package.json`의 Next.js 버전은 `16.2.9`다.
- 글 데이터는 DB가 아니라 `content/posts` 디렉터리의 Markdown 파일에 저장된다.
- `lib/posts.ts`는 `fs.readFileSync`와 `gray-matter`를 사용해 Markdown 파일과 frontmatter를 읽는다.
- 현재 공개 글 목록, 태그 목록, 글 상세 페이지, RSS는 파일 시스템의 글 데이터를 기준으로 생성된다.

### 추론

- 현재 구조는 DB가 없어도 배포할 수 있는 파일 기반 블로그 구조와 일치한다.
- DB를 도입하는 작업은 단순한 배포 설정 변경이 아니라, 글 저장소와 조회 흐름을 바꾸는 애플리케이션 구조 변경이다.
- 따라서 AWS 배포와 DB 전환을 한 번에 진행하면, 빌드 문제, 네트워크 문제, DB 스키마 문제, 데이터 마이그레이션 문제를 동시에 디버깅해야 한다.

### 가정

- DB를 붙이려는 목적은 운영 필수 요건보다 학습과 확장 경험에 가깝다.
- 이후 추가할 수 있는 동적 기능은 관리자 글 작성, 조회수, 댓글, 검색, 초안 관리 중 일부다.
- 초기 배포 대상 Region은 서울 리전인 `ap-northeast-2`로 둔다. 다른 Region을 선택하면 RDS, ECS, ECR, Secrets Manager 리소스를 같은 Region에 맞춘다.

## 배포 전략

### 선택안

1. S3 + CloudFront
   - 정적 export가 가능한 경우 가장 단순하다.
   - 서버 런타임과 DB 연결을 직접 다루는 학습에는 맞지 않는다.

2. Amplify Hosting
   - Git 연동과 프론트엔드 배포는 간단하다.
   - AWS 문서 기준 Amplify Hosting compute는 Next.js 12-15 SSR 지원을 명시한다.
   - 현재 프로젝트는 Next.js 16.2.9이므로, Next.js 16 SSR 지원을 별도로 검증하지 않으면 기본 선택지로 두기 어렵다.

3. ECS Express Mode 또는 ECS Fargate
   - Next.js 애플리케이션을 Docker 이미지로 만들고 AWS에서 컨테이너로 실행한다.
   - RDS PostgreSQL, VPC, security group, Secrets Manager, CloudWatch를 함께 다룰 수 있다.
   - 서버와 DB 배포를 직접 익히려는 목적에 가장 잘 맞는다.

### 결정

초기 목표에는 ECS Express Mode 또는 ECS Fargate를 사용한다.

선택 근거는 다음과 같다.

- Next.js 16 애플리케이션을 일반 Node.js 컨테이너로 실행할 수 있다.
- RDS PostgreSQL을 private subnet에 두고, 애플리케이션 컨테이너에서만 접근하도록 네트워크 경계를 설정할 수 있다.
- 배포 산출물, 런타임 환경 변수, 로그, health check, HTTPS, 도메인 연결을 직접 확인할 수 있다.
- AWS App Runner는 2026년 4월 30일부터 신규 고객에게 열리지 않는다고 AWS 문서가 명시하므로, 새 프로젝트의 기본 선택지로 두지 않는다.

## 대상 아키텍처

```text
사용자
  ↓
Route 53
  ↓
Application Load Balancer
  ↓
ECS Express Mode 또는 ECS Fargate
  ↓
Next.js Node.js 서버
  ↓
RDS PostgreSQL
```

정적 이미지와 폰트는 처음에는 Next.js 컨테이너의 `public` 디렉터리에서 제공한다. 이미지가 많아지거나 업로드 기능을 추가하면 S3와 CloudFront를 별도 정적 자산 저장소로 분리한다.

## 단계별 계획

### 1. 로컬 배포 형태 확정

목표는 로컬에서 production build와 production server 실행을 먼저 검증하는 것이다.

작업:

- `pnpm typecheck`로 TypeScript 타입 오류를 확인한다.
- `pnpm lint`로 ESLint 오류를 확인한다.
- `pnpm build`로 Next.js production build를 확인한다.
- `pnpm start`로 production server를 실행한다.
- `/`, `/posts`, `/posts/[slug]`, `/tags/[tag]`, `/feed.xml`, `/robots.txt`, `/sitemap.xml`을 확인한다.

완료 기준:

- production build가 성공한다.
- production server에서 주요 페이지가 200 응답을 반환한다.
- Markdown 기반 글 목록과 상세 페이지가 정상 렌더링된다.

### 2. Docker 배포 산출물 만들기

목표는 AWS에 올릴 수 있는 동일한 실행 단위를 만드는 것이다.

작업:

- `next.config.ts`에 standalone output을 설정한다.
- `Dockerfile`을 추가한다.
- Docker 이미지에 `.next/standalone`, `.next/static`, `public`, `content`를 포함한다.
- 컨테이너의 실행 포트는 `3000`으로 둔다.
- `/api/health` Route Handler를 추가해 load balancer health check에 사용한다.

완료 기준:

- `docker build`가 성공한다.
- `docker run -p 3000:3000`으로 실행한 컨테이너에서 주요 페이지가 정상 응답한다.
- `/api/health`가 DB 없이도 200 응답을 반환한다.

### 3. AWS 컨테이너 배포

목표는 DB 없이 현재 블로그를 AWS에서 먼저 공개하는 것이다.

작업:

- ECR repository를 생성한다.
- Docker 이미지를 ECR에 push한다.
- ECS Express Mode 또는 ECS Fargate 서비스를 생성한다.
- 컨테이너 포트 `3000`을 load balancer target으로 연결한다.
- CloudWatch Logs에서 애플리케이션 로그를 확인한다.
- Route 53과 ACM으로 도메인과 HTTPS를 연결한다.

완료 기준:

- AWS 제공 URL 또는 커스텀 도메인에서 블로그 첫 화면이 열린다.
- 주요 페이지가 200 응답을 반환한다.
- CloudWatch Logs에서 서버 시작 로그와 요청 로그를 확인할 수 있다.

### 4. PostgreSQL 도입

목표는 DB 연결, schema migration, 런타임 secret 관리를 배포 환경에서 검증하는 것이다.

작업:

- RDS PostgreSQL 인스턴스를 생성한다.
- RDS는 public access를 끄고 private subnet에 둔다.
- RDS security group은 ECS service security group에서 오는 PostgreSQL 포트만 허용한다.
- `DATABASE_URL`은 Secrets Manager 또는 SSM Parameter Store에 저장한다.
- 애플리케이션 런타임 환경 변수로 `DATABASE_URL`을 주입한다.
- ORM은 Prisma 또는 Drizzle 중 하나를 선택한다.

권장 선택:

- 빠른 개발과 migration 경험이 목적이면 Prisma를 선택한다.
- SQL과 타입 기반 query builder 경험을 더 중시하면 Drizzle을 선택한다.

완료 기준:

- 로컬과 AWS에서 같은 migration이 적용된다.
- 애플리케이션 컨테이너가 RDS에 연결할 수 있다.
- DB 연결 실패 시 로그에서 원인을 추적할 수 있다.

### 5. 글 데이터 모델 설계

목표는 Markdown frontmatter 구조를 DB schema로 옮길 수 있게 만드는 것이다.

초기 테이블:

```text
posts
- id
- slug
- title
- description
- content
- date
- published_at
- draft
- cover_image
- cover_alt
- created_at
- updated_at

tags
- id
- name

post_tags
- post_id
- tag_id
```

설계 기준:

- `slug`는 공개 URL에 사용하므로 unique constraint를 둔다.
- `draft`가 `true`인 글은 공개 목록, sitemap, RSS에서 제외한다.
- 태그는 문자열 배열로 저장하지 않고 `tags`와 `post_tags`로 분리한다.
- 본문은 초기에는 Markdown 문자열로 저장한다.

완료 기준:

- 기존 Markdown frontmatter 필드를 손실 없이 DB row로 표현할 수 있다.
- 공개 글 조회, slug 조회, 태그별 조회, 관련 글 조회를 SQL 또는 ORM query로 작성할 수 있다.

### 6. 데이터 접근 계층 분리

목표는 파일 기반 저장소와 DB 기반 저장소를 교체 가능하게 만드는 것이다.

작업:

- `PostRepository` 역할의 인터페이스를 정의한다.
- 파일 기반 구현은 현재 `lib/posts.ts`의 동작을 감싼다.
- DB 기반 구현은 PostgreSQL에서 같은 형태의 데이터를 반환한다.
- UI 컴포넌트는 파일 시스템 또는 DB 구현을 직접 알지 않도록 한다.

완료 기준:

- 공개 페이지는 저장소 구현이 파일인지 DB인지 몰라도 같은 props를 받는다.
- DB 전환 중에도 기존 Markdown 기반 렌더링을 유지할 수 있다.
- 테스트에서 repository 구현을 mock 또는 stub으로 대체할 수 있다.

### 7. Markdown 데이터 마이그레이션

목표는 기존 `content/posts` 글을 DB로 안전하게 옮기는 것이다.

작업:

- `content/posts` 파일을 읽는 migration script를 작성한다.
- frontmatter 검증 로직은 기존 schema와 동일한 규칙을 사용한다.
- 같은 `slug`가 이미 있으면 update하거나 skip하는 정책을 명시한다.
- migration 후 글 개수, 태그 개수, slug 목록을 검증한다.

완료 기준:

- DB의 공개 글 수가 기존 Markdown 공개 글 수와 일치한다.
- 각 글의 title, description, date, tags, draft, content가 예상대로 저장된다.
- `/posts/[slug]`에서 기존 URL이 유지된다.

### 8. 읽기 흐름 전환

목표는 공개 페이지의 데이터 소스를 DB로 바꾸는 것이다.

작업:

- 글 목록 조회를 DB repository로 전환한다.
- slug 상세 조회를 DB repository로 전환한다.
- 태그 목록과 태그별 글 조회를 DB repository로 전환한다.
- RSS, sitemap, metadata 생성 경로도 같은 repository를 사용하게 맞춘다.

완료 기준:

- 기존 URL이 깨지지 않는다.
- draft 글이 공개 목록, RSS, sitemap에서 제외된다.
- Markdown 기반 결과와 DB 기반 결과가 같은지 비교할 수 있다.

### 9. 운영 기본값 설정

목표는 배포 후 장애 원인을 좁힐 수 있는 최소 운영 장치를 갖추는 것이다.

작업:

- `/api/health`는 프로세스 생존 확인만 담당한다.
- `/api/ready`는 DB 연결 가능 여부까지 확인한다.
- CloudWatch log retention 기간을 설정한다.
- 배포 실패, 5xx 증가, CPU 또는 memory 사용량에 대한 alarm을 설정한다.
- RDS automated backup을 켠다.
- RDS password는 코드나 `.env` 파일에 커밋하지 않는다.

완료 기준:

- 애플리케이션 프로세스 문제와 DB 연결 문제를 서로 다른 endpoint로 구분할 수 있다.
- 배포 후 오류가 CloudWatch에서 확인된다.
- DB secret이 repository에 저장되지 않는다.

## 검증 계획

### 로컬 검증

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

Docker 도입 후:

```bash
docker build -t blog .
docker run --rm -p 3000:3000 blog
```

DB 도입 후:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

### AWS 검증

- 배포 URL에서 `/`가 200 응답을 반환한다.
- `/posts`가 공개 글 목록을 보여준다.
- `/feed.xml`이 XML content type으로 응답한다.
- `/sitemap.xml`에 공개 글 URL이 포함된다.
- `/api/health`가 200 응답을 반환한다.
- DB 도입 후 `/api/ready`가 RDS 연결 성공 시 200 응답을 반환한다.
- RDS security group이 외부 전체 공개 접근을 허용하지 않는다.

## 리스크와 대응

### Next.js 16과 AWS managed hosting 호환성

확인된 사실은 현재 프로젝트가 Next.js 16.2.9라는 점이다. AWS Amplify 문서에서 확인한 지원 범위는 Next.js 12-15 SSR이다.

따라서 Amplify SSR 배포를 선택하면 호환성이 불확실하다. 이 불확실성을 줄이기 위해 Next.js를 일반 Node.js 컨테이너로 실행하는 ECS 계열 배포를 우선한다.

### DB 전환으로 인한 공개 URL 변경

`slug`는 기존 파일 이름에서 만들어진 공개 URL 식별자다. DB 전환 시 slug 생성 규칙이 바뀌면 기존 URL이 깨질 수 있다.

대응:

- migration script에서 기존 파일 이름 기반 slug를 그대로 저장한다.
- `posts.slug`에 unique constraint를 둔다.
- slug 변경이 필요하면 redirect table을 별도로 둔다.

### 빌드 시점 데이터와 런타임 데이터의 차이

현재 파일 기반 구조는 빌드 시점 또는 서버 실행 시점에 파일을 읽는다. DB 전환 후에는 요청 시점 또는 cache revalidation 시점에 DB를 읽는다.

대응:

- 공개 글 목록과 상세 페이지의 cache 정책을 명시한다.
- 글 작성 또는 수정 기능을 붙이기 전까지는 수동 재배포 또는 명시적 revalidation 정책 중 하나를 선택한다.
- cache 문제를 디버깅할 수 있도록 응답 생성 시점과 데이터 갱신 시점을 로그로 남긴다.

### 비용 증가

RDS, ECS/Fargate, Application Load Balancer, NAT Gateway, CloudWatch Logs는 비용이 발생한다.

대응:

- 학습 단계에서는 최소 사양을 사용한다.
- NAT Gateway가 필요한 구조인지 먼저 검토한다.
- 사용하지 않는 preview 리소스와 오래된 ECR 이미지를 정리한다.
- RDS는 필요 없을 때 중지하거나 삭제한다.

## 작업 순서 요약

1. 현재 파일 기반 블로그를 production build로 검증한다.
2. Docker standalone 배포 형태를 만든다.
3. DB 없이 ECS에 먼저 배포한다.
4. RDS PostgreSQL과 secret 주입을 설정한다.
5. 글 schema와 repository 경계를 만든다.
6. Markdown 데이터를 DB로 마이그레이션한다.
7. 공개 읽기 흐름을 DB로 전환한다.
8. health check, logging, backup, alarm을 운영 기본값으로 추가한다.

## 참고 문서

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- Next.js standalone output: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
- Amazon ECS Express Mode: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html
- Amazon RDS PostgreSQL 시작하기: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.PostgreSQL.html
- AWS App Runner availability change: https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
- AWS Amplify Next.js 지원 범위: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html
