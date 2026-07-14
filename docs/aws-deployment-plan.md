# AWS Next.js 서버 배포

## Goal

Next.js 블로그를 standalone Node.js 서버로 빌드하고 Docker 컨테이너로 실행한다. 글 페이지는 Static Site Generation(SSG)을 유지하고, Route Handler처럼 요청 시점에 실행되는 기능을 함께 제공한다.

이 문서에서 서버는 별도 Express 애플리케이션이 아니라 Next.js standalone 산출물의 `server.js` 프로세스를 뜻한다.

## Prerequisites

- Node.js 22
- pnpm 11.9.0
- Docker
- AWS CLI를 실행할 수 있는 AWS 계정과 권한
- 서로 다른 가용 영역의 퍼블릭 서브넷 2개 이상
- 운영 도메인을 포함하는 AWS Certificate Manager(ACM) 인증서
- 실제 공개 URL

## Architecture

```text
사용자
  ↓ HTTPS
Application Load Balancer
  ↓
ECS의 Next.js 컨테이너
  ↓
standalone server.js

main push
  ↓ OIDC 임시 자격 증명
GitHub Actions
  ↓ Docker 이미지
Amazon ECR
  ↓ 태스크 정의 갱신
Amazon ECS
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

### 5. AWS 인프라 생성

[`ecs-stack.yml`](../infra/ecs-stack.yml)은 다음 리소스를 생성한다.

- Amazon ECR repository
- ECS Fargate cluster, task definition, service
- Application Load Balancer, HTTPS listener, target group
- `/api/health`를 사용하는 target group health check
- CloudWatch Logs log group
- `main` 브랜치만 신뢰하는 GitHub OIDC provider와 배포 역할

인증서 DNS 검증을 완료한 뒤 다음 명령으로 스택을 생성한다.

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name blog-ecs \
  --template-file infra/ecs-stack.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    VpcId=<vpc-id> \
    PublicSubnetIds=<subnet-a>,<subnet-b> \
    CertificateArn=<certificate-arn>
```

스택은 유효한 애플리케이션 이미지가 아직 없으므로 ECS service의 `DesiredCount`를 `0`으로 생성한다. 첫 자동 배포가 새 이미지를 등록한 뒤 `DesiredCount`를 `1`로 바꾸고 service 안정화까지 기다린다.

### 6. main 자동 배포

[`deploy-ecs.yml`](../.github/workflows/deploy-ecs.yml)은 `main` 갱신을 다음 순서로 처리한다.

1. GitHub OIDC token으로 `blog-deploy-role`의 임시 자격 증명을 받는다.
2. `NEXT_PUBLIC_SITE_URL`을 사용해 Docker 이미지를 빌드한다.
3. 커밋 SHA를 이미지 태그로 사용해 ECR에 push한다.
4. ECS task definition에 새 이미지 URI를 반영한다.
5. ECS service를 갱신하고 안정화까지 기다린다.

커밋 SHA 태그는 같은 태그를 다시 쓰지 않는다. 이전 task definition revision에는 이전 이미지 URI가 남으므로 롤백 대상을 구분할 수 있다.

ECS 배포와 target group health check가 성공한 뒤 `devlog.dropai.site`의 CNAME을 Application Load Balancer DNS 이름으로 변경한다. 전환 전까지 기존 호스팅 레코드를 유지하면 운영 중단 위험을 줄일 수 있다.

### 7. 런타임 비밀 값 설정

현재 애플리케이션은 `NEXT_PUBLIC_SITE_URL`과 공개용 Supabase Publishable key만 사용한다. 서버 전용 API key나 DB 연결 문자열을 추가할 때는 코드와 Docker 이미지에 넣지 않는다. ECS task definition에서 Secrets Manager 또는 Parameter Store 값을 환경 변수로 주입한다.

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

AWS 구성 검증:

```bash
aws cloudformation validate-template --template-body file://infra/ecs-stack.yml
aws ecs describe-services --cluster blog --services blog
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

완료 조건:

- 주요 페이지가 HTTP 200으로 응답한다.
- `/api/health`가 `Cache-Control: no-store`와 `{"status":"ok"}`를 반환한다.
- 글 상세 HTML에 본문과 canonical URL이 포함된다.
- 컨테이너가 비 root 사용자로 실행된다.
- Load Balancer가 컨테이너를 정상 target으로 판단한다.
- GitHub Actions가 `main` 커밋 SHA와 같은 ECR 이미지 태그를 배포한다.

## 운영 시 주의사항

- 서버 배포는 컨테이너, Load Balancer, 로그 등 실행 리소스의 비용과 운영 책임을 추가한다.
- `/api/health`는 프로세스 생존만 확인한다. DB 연결 확인이 필요하면 별도의 readiness endpoint로 분리한다.
- `main`의 Markdown 글을 수정하면 자동 배포가 새 이미지를 빌드한다.
- 배포 후 오류가 발생하면 build 실패, 컨테이너 시작 실패, health check 실패를 구분해 확인한다.
