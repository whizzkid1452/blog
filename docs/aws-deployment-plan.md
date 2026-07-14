# AWS Next.js 서버 배포

## Goal

Next.js 블로그를 standalone Node.js 서버로 빌드하고 Docker 컨테이너로 실행한다. 글 페이지는 Static Site Generation(SSG)을 유지하고, Route Handler처럼 요청 시점에 실행되는 기능을 함께 제공한다.

이 문서에서 서버는 별도 Express 애플리케이션이 아니라 Next.js standalone 산출물의 `server.js` 프로세스를 뜻한다.

## Prerequisites

- Node.js 22
- pnpm 11.9.0
- Docker
- 컨테이너 이미지를 실행할 AWS 계정과 권한
- 실제 공개 URL

## Architecture

```text
사용자
  ↓ HTTPS
Load Balancer
  ↓
ECS의 Next.js 컨테이너
  ↓
standalone server.js
```

확인된 코드 구성은 다음과 같다.

- `next.config.ts`는 `output: 'standalone'`을 사용한다.
- `Dockerfile`은 `.next/standalone`, `.next/static`, `public`, `content`를 실행 이미지에 포함한다.
- 컨테이너는 비 root 사용자인 `nextjs`로 실행된다.
- `/api/health`는 DB 연결과 무관하게 프로세스가 요청에 응답하는지 확인한다.
- 공개 글 페이지는 `generateStaticParams()`를 사용하므로 서버 배포 후에도 SSG 결과를 제공한다.

## Step-by-Step Guide

### 1. 로컬 production build 검증

PowerShell에서는 다음 명령을 실행한다.

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://example.com'
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Bash 계열 셸에서는 다음 명령을 실행한다.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com pnpm install --frozen-lockfile
NEXT_PUBLIC_SITE_URL=https://example.com pnpm build
NEXT_PUBLIC_SITE_URL=https://example.com pnpm start
```

`NEXT_PUBLIC_SITE_URL`은 canonical, sitemap, RSS, Open Graph URL 생성에 사용한다. production build에서는 로컬 주소가 아닌 실제 공개 URL을 사용해야 한다.

### 2. 로컬 서버 확인

서버가 실행되면 다음 경로를 확인한다.

- `/`
- `/posts`
- 공개 글의 `/posts/{slug}`
- 공개 태그의 `/tags/{tag}`
- `/feed.xml`
- `/sitemap.xml`
- `/robots.txt`
- `/api/health`

health endpoint의 예상 응답은 다음과 같다.

```json
{ "status": "ok" }
```

### 3. Docker 이미지 생성

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://example.com \
  -t blog:latest \
  .
```

`NEXT_PUBLIC_SITE_URL`은 `NEXT_PUBLIC_` 접두사를 사용하므로 비밀 값이 아니다. 비밀번호나 관리자 API key를 Docker build argument로 전달하지 않는다.

### 4. Docker 컨테이너 실행

```bash
docker run --rm -p 3000:3000 blog:latest
```

다른 포트를 사용하려면 컨테이너의 `PORT` 환경 변수와 공개 포트를 함께 변경한다.

```bash
docker run --rm -e PORT=8080 -p 8080:8080 blog:latest
```

### 5. AWS 컨테이너 배포

AWS에서는 다음 순서로 배포한다.

1. Amazon ECR repository를 생성한다.
2. Docker 이미지를 ECR에 push한다.
3. 이미지와 컨테이너 포트 `3000`을 사용하는 ECS task definition을 만든다.
4. ECS service를 생성하고 Load Balancer target group에 연결한다.
5. target group health check 경로를 `/api/health`로 설정한다.
6. CloudWatch Logs에서 서버 시작과 오류 로그를 확인한다.
7. Route 53과 인증서를 연결해 HTTPS 도메인을 구성한다.

ECS 실행 역할, ECR 접근 권한, VPC, subnet, security group은 AWS 계정의 기존 네트워크 정책에 맞춰 설정해야 한다. 저장소 코드만으로 해당 리소스가 자동 생성되지는 않는다.

### 6. 런타임 비밀 값 설정

서버 전용 API key나 DB 연결 문자열은 코드와 Docker 이미지에 넣지 않는다. ECS task definition에서 Secrets Manager 또는 Parameter Store 값을 환경 변수로 주입한다.

공개 URL처럼 클라이언트 번들에 포함해도 되는 값과 서버 비밀 값을 구분한다.

```text
NEXT_PUBLIC_SITE_URL       공개 값
DATABASE_URL               서버 비밀 값
SUPABASE_SECRET_KEY        서버 비밀 값
```

## Verify Final Result

로컬 검증:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

컨테이너 검증:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://example.com -t blog:latest .
docker run --rm -p 3000:3000 blog:latest
```

완료 조건:

- 주요 페이지가 HTTP 200으로 응답한다.
- `/api/health`가 `Cache-Control: no-store`와 `{"status":"ok"}`를 반환한다.
- 글 상세 HTML에 본문과 canonical URL이 포함된다.
- 컨테이너가 비 root 사용자로 실행된다.
- Load Balancer가 컨테이너를 정상 target으로 판단한다.

## 운영 시 주의사항

- 서버 배포는 컨테이너, Load Balancer, 로그 등 실행 리소스의 비용과 운영 책임을 추가한다.
- `/api/health`는 프로세스 생존만 확인한다. DB 연결 확인이 필요하면 별도의 readiness endpoint로 분리한다.
- Markdown 글을 수정하면 새 이미지를 빌드하고 배포해야 한다.
- 배포 후 오류가 발생하면 build 실패, 컨테이너 시작 실패, health check 실패를 구분해 확인한다.
