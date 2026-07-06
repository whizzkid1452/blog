# Work Log

## 2026-07-04

### AWS 배포 준비 플랜 작성

확인된 사실:

- 현재 블로그는 Next.js App Router 기반 애플리케이션이다.
- 글 데이터는 DB가 아니라 `content/posts`의 Markdown 파일에서 읽는다.
- `lib/posts.ts`는 `fs.readFileSync`와 `gray-matter`로 Markdown 본문과 frontmatter를 파싱한다.

작업:

- `docs/aws-deployment-plan.md`를 추가했다.
- 배포 경로를 파일 기반 블로그 배포와 DB 전환으로 분리했다.
- 서버 실행 환경은 Next.js Node.js 런타임으로 정의했다.
- AWS 배포 대상은 ECS Express Mode 또는 ECS Fargate와 RDS PostgreSQL 조합으로 정리했다.
- S3 + CloudFront, Amplify Hosting, ECS 계열 배포의 차이를 비교했다.
- DB 전환 단계로 schema 설계, repository 경계, Markdown 데이터 마이그레이션, 읽기 흐름 전환을 정리했다.

검증:

```bash
npx prettier --write docs/aws-deployment-plan.md
pnpm lint
pnpm typecheck
```

결과:

- `docs/aws-deployment-plan.md` 포맷 확인 완료.
- `pnpm lint` 통과.
- `pnpm typecheck` 통과.

### 1단계: 로컬 production 배포 형태 검증

목표:

- 현재 파일 기반 블로그가 로컬 production build와 production server에서 정상 동작하는지 확인한다.

작업:

- TypeScript 타입 검사를 실행했다.
- ESLint 검사를 실행했다.
- Next.js production build를 실행했다.
- `3000` 포트가 이미 사용 중이어서 production server를 `3001` 포트에서 실행했다.
- 주요 페이지와 메타 route의 HTTP 응답을 확인했다.

검증:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm exec next start -p 3001
```

확인한 URL:

- `/`
- `/posts`
- `/posts/audio-editor-zoom-raf-throttling`
- `/tags/architecture`
- `/feed.xml`
- `/robots.txt`
- `/sitemap.xml`

결과:

- `pnpm typecheck` 통과.
- `pnpm lint` 통과.
- `pnpm build` 통과.
- Next.js build 결과에서 76개 static page가 생성됐다.
- `/`, `/posts`, 글 상세 페이지, 태그 페이지는 `200 text/html`로 응답했다.
- `/feed.xml`은 `200 application/rss+xml`로 응답했다.
- `/robots.txt`는 `200 text/plain`으로 응답했다.
- `/sitemap.xml`은 `200 application/xml`로 응답했다.

제한 사항:

- 브라우저 세션을 사용할 수 없어 실제 시각 렌더링은 확인하지 못했다.
- 대신 HTTP 상태 코드, content type, HTML 내부의 title과 글 제목 포함 여부를 확인했다.

### 기존 변경분 커밋

작업:

- 당시 작업 트리의 전체 변경분을 포맷하고 검증한 뒤 커밋했다.

검증:

```bash
npx prettier --write .
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

결과:

- `pnpm test` 통과: 5개 test file, 18개 test.
- `pnpm lint` 통과.
- `pnpm typecheck` 통과.
- `pnpm build` 통과.
- 커밋 생성: `0441355 docs: add AWS deployment plan`.

### 2단계: Docker standalone 배포 산출물 준비

목표:

- AWS 컨테이너 배포에 사용할 수 있는 Next.js standalone 실행 구조를 만든다.

작업:

- `next.config.ts`에 `output: 'standalone'`을 설정했다.
- `.dockerignore`를 추가했다.
- `Dockerfile`을 추가했다.
- `/api/health` route를 추가했다.
- `/api/health` route 테스트를 추가했다.

구현한 health check 의미:

- `/api/health`는 애플리케이션 프로세스가 HTTP 요청에 응답 가능한지만 확인한다.
- DB 연결 가능 여부까지 확인하는 readiness check는 아직 구현하지 않았다.
- 이 구분은 이후 RDS를 붙였을 때 프로세스 생존 문제와 DB 연결 문제를 분리해서 보기 위한 것이다.

검증:

```bash
pnpm test app/api/health/route.test.ts
npx prettier --write .
pnpm test
pnpm lint
pnpm typecheck
pnpm build
PORT=3002 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

결과:

- health route 테스트는 처음에는 `./route` 모듈이 없어 실패했다.
- `/api/health` route 구현 후 health route 테스트가 통과했다.
- 전체 테스트 통과: 6개 test file, 19개 test.
- `pnpm lint` 통과.
- `pnpm typecheck` 통과.
- `pnpm build` 통과.
- build 결과에서 `/api/health`는 dynamic route로 표시됐다.
- `.next/standalone/server.js`가 생성됐다.
- standalone server를 `3002` 포트에서 실행했다.
- `/api/health`는 `200 application/json`과 `{"status":"ok"}`로 응답했다.
- `/api/health` 응답에 `Cache-Control: no-store`가 포함됐다.
- `/`, 글 상세 페이지, `/feed.xml`, `/sitemap.xml`이 standalone server에서 정상 응답했다.

제한 사항:

- 현재 실행 환경에 `docker` 명령이 없어 실제 `docker build`와 `docker run`은 실행하지 못했다.
- 대신 Dockerfile이 실행하는 것과 같은 entrypoint인 `.next/standalone/server.js`를 직접 실행해 Node.js runtime 동작을 확인했다.
- 이 검증은 Docker 이미지 빌드 성공을 증명하지 않는다. Dockerfile 문법, Linux 이미지 내부 의존성, 컨테이너 파일 복사 경로는 Docker가 설치된 환경에서 별도로 확인해야 한다.

### 커밋 분리 결과

확인된 사실:

- AWS 배포 계획 문서, Mermaid diagram 렌더링, Docker standalone 배포 준비를 목적별로 분리했다.
- 각 목적은 별도 커밋으로 기록했다.

커밋:

- `0441355 docs: add AWS deployment plan`
- `2a1ceda feat(markdown): render Mermaid diagrams`
- `223577d feat(deploy): add standalone Docker runtime`

추론:

- Mermaid diagram 렌더링과 Docker standalone 배포 준비는 변경 목적, 검증 관점, 롤백 범위가 다르다.
- 두 변경을 별도 커밋으로 분리하면 이후 PR을 만들 때 목적 단위로 설명하기 쉽다.

남은 일:

- Docker가 설치된 환경에서 `docker build -t blog .`를 실행한다.
- Docker 이미지 실행 후 `http://localhost:3000/api/health`를 확인한다.
- Docker 컨테이너에서 `/`, 글 상세 페이지, `/feed.xml`, `/sitemap.xml`을 다시 확인한다.
- AWS 배포 단계로 넘어가기 전에 ECR repository 이름, AWS Region, 도메인 사용 여부를 확정한다.

## 2026-07-05

### 2단계: Docker standalone 컨테이너 검증

목표:

- AWS에 push할 Docker 이미지가 로컬 컨테이너 런타임에서 정상 실행되는지 확인한다.

확인된 사실:

- 현재 환경에서 Docker CLI는 사용 가능하다.
- Docker 버전은 `29.6.1`이다.
- `3000` 포트는 기존 `node` 프로세스가 listen 중이었다.
- 현재 환경에는 `curl` 명령이 설치되어 있지 않다.
- 현재 셸에는 AWS CLI가 설치되어 있지 않다.
- 현재 환경에는 `~/.aws` 설정 디렉터리가 없다.

작업:

- `docker build -t blog .`로 Docker 이미지를 빌드했다.
- 처음에는 `-p 3000:3000`으로 컨테이너 실행을 시도했다.
- 호스트 `3000` 포트 충돌 때문에 컨테이너 실행 명령이 실패했다.
- 호스트 포트만 `3003`으로 바꿔 같은 컨테이너 포트 `3000`을 검증했다.
- `curl` 대신 Node.js 내장 `fetch`로 주요 URL의 HTTP 응답을 확인했다.
- 검증 후 `blog-aws-verify` 컨테이너를 중지했다.

검증:

```bash
docker build -t blog .
docker run --rm --detach --name blog-aws-verify -p 3003:3000 blog
node - <<'NODE'
const paths = [
  '/api/health',
  '/',
  '/posts',
  '/posts/audio-editor-zoom-raf-throttling',
  '/tags/architecture',
  '/feed.xml',
  '/robots.txt',
  '/sitemap.xml',
];

for (const path of paths) {
  const response = await fetch(`http://localhost:3003${path}`);
  console.log(`${response.status} ${response.headers.get('content-type')} ${path}`);
}
NODE
docker logs blog-aws-verify
docker stop blog-aws-verify
```

확인한 URL:

- `/api/health`
- `/`
- `/posts`
- `/posts/audio-editor-zoom-raf-throttling`
- `/tags/architecture`
- `/feed.xml`
- `/robots.txt`
- `/sitemap.xml`

결과:

- `docker build -t blog .` 통과.
- Docker 컨테이너에서 Next.js 서버가 `0.0.0.0:3000`으로 시작됐다.
- `/api/health`는 `200 application/json`으로 응답했다.
- `/`, `/posts`, 글 상세 페이지, 태그 페이지는 `200 text/html`로 응답했다.
- `/feed.xml`은 `200 application/rss+xml`로 응답했다.
- `/robots.txt`는 `200 text/plain`으로 응답했다.
- `/sitemap.xml`은 `200 application/xml`로 응답했다.

추론:

- Dockerfile의 multi-stage build, standalone server 복사 경로, `public`과 `content` 복사 경로는 현재 로컬 Docker 런타임에서 동작한다.
- `-p 3000:3000` 실패는 Docker 이미지 내부 실행 실패가 아니라, 호스트 포트 선점으로 인한 포트 바인딩 실패와 일치한다.

제한 사항:

- AWS CLI가 없어 현재 셸에서는 ECR repository 생성, Docker image push, ECS service 생성 명령을 실행할 수 없다.
- `~/.aws` 설정 디렉터리가 없어 컨테이너형 AWS CLI를 사용하더라도 현재 상태만으로는 AWS 계정 인증을 확인할 수 없다.
- 실제 AWS 배포 가능 여부는 AWS CLI 설치와 인증, 또는 컨테이너 기반 AWS CLI 실행 환경이 준비된 뒤 검증해야 한다.

다음 작업:

- AWS CLI를 설치하고 `aws sts get-caller-identity`로 인증 상태를 확인한다.
- ECR repository 이름을 정한다. 기본 후보는 `blog`다.
- AWS Region을 확정한다. 기존 계획의 기본값은 `ap-northeast-2`다.
- 도메인 연결을 이번 단계에 포함할지, AWS 제공 load balancer DNS에서 먼저 검증할지 결정한다.
- ECR repository 생성 후 `blog:latest` 이미지를 push한다.

### AWS CLI SSO 프로필 설정

목표:

- AWS 배포 작업을 root 인증이 아닌 IAM Identity Center SSO 프로필로 실행할 수 있게 한다.

확인된 사실:

- AWS CLI 버전은 `2.35.15`다.
- `default` 프로필은 root 로그인 세션을 사용한다.
- root 계정 MFA는 켜져 있다.
- `My Zero-Spend Budget` 예산이 생성되어 있고 한도는 `1 USD`다.
- IAM Identity Center 인스턴스는 `us-east-1`에 활성화되어 있다.
- 배포 리소스 기본 리전은 `ap-northeast-2`로 설정했다.

작업:

- IAM Identity Center의 실제 활성 리전을 확인했다.
- `blog` SSO 프로필을 추가했다.
- `blog` 프로필의 기본 리전을 `ap-northeast-2`로 설정했다.
- `blog` 프로필의 출력 형식을 `json`으로 설정했다.
- `aws sts get-caller-identity --profile blog`로 인증 주체를 확인했다.

검증:

```bash
aws configure list-profiles
aws sts get-caller-identity --profile blog
aws configure get region --profile blog
```

결과:

- `blog` 프로필이 생성됐다.
- `blog` 프로필은 `AWSReservedSSO_AdministratorAccess_38fa79dbee0ea490` assumed role로 인증된다.
- `blog` 프로필의 계정 ID는 `424503481518`이다.
- `blog` 프로필의 기본 리전은 `ap-northeast-2`다.

구분:

- SSO region은 `us-east-1`이다. 이는 IAM Identity Center가 활성화된 리전이다.
- 배포 리전은 `ap-northeast-2`다. 이는 ECR, ECS, RDS 같은 블로그 배포 리소스를 만들 기본 리전이다.

다음 작업:

- 이후 AWS 명령은 `--profile blog`를 붙여 실행한다.
- ECR repository를 생성한다.
- Docker 이미지를 ECR에 push한다.

### 3단계: ECR repository 생성과 Docker 이미지 push

목표:

- 로컬에서 검증한 Docker 이미지를 AWS ECR에 업로드해 ECS 배포에서 참조할 수 있게 한다.

확인된 사실:

- ECR repository 이름은 `blog`다.
- ECR repository 리전은 `ap-northeast-2`다.
- ECR repository URI는 `424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog`다.
- ECR repository의 image tag mutability는 `MUTABLE`이다.
- ECR repository 생성 직후 scan on push는 꺼져 있었다.
- ECR repository의 encryption type은 `AES256`이다.
- 최초 push에 사용한 로컬 Docker 이미지 `blog:latest`의 digest는 `sha256:309d49b9588fe0ae139bb2d4dbfe70716a993c3f64430b45e1df8cb017337356`다.

작업:

- `blog` ECR repository를 생성했다.
- `blog` SSO 프로필로 ECR registry에 Docker login을 수행했다.
- 로컬 `blog:latest` 이미지를 ECR repository URI로 태그했다.
- `latest` 태그를 ECR에 push했다.
- ECR에서 push된 이미지 tag와 digest를 조회했다.

검증:

```bash
aws ecr create-repository --repository-name blog --profile blog
aws ecr get-login-password --region ap-northeast-2 --profile blog \
  | docker login --username AWS --password-stdin 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com
docker tag blog:latest 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:latest
docker push 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:latest
aws ecr describe-images --repository-name blog --image-ids imageTag=latest --profile blog
```

결과:

- Docker login은 `Login Succeeded`로 완료됐다.
- ECR image push가 완료됐다.
- ECR의 `latest` image digest는 `sha256:309d49b9588fe0ae139bb2d4dbfe70716a993c3f64430b45e1df8cb017337356`다.
- ECR image size는 `77460586` bytes다.
- push 시각은 `2026-07-06T09:29:19.756000+09:00`다.

추론:

- ECS task definition은 `424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:latest` 이미지를 참조할 수 있다.
- 로컬 이미지 digest와 ECR image digest가 같으므로, 이번 push는 로컬에서 검증한 Docker 이미지와 같은 manifest를 ECR에 등록한 것으로 볼 수 있다.

제한 사항:

- `latest` 태그는 변경 가능한 tag이므로 배포 재현성을 엄밀히 보장하려면 digest 또는 immutable version tag를 사용하는 편이 더 안전하다.
- scan on push가 꺼져 있으므로, 이미지 취약점 스캔 결과는 아직 없다.

다음 작업:

- ECR repository의 scan on push를 켤지 결정한다.
- 배포 재현성을 위해 `latest` 외에 날짜 또는 Git commit 기반 tag를 추가할지 결정한다.
- ECS/Fargate 배포에 필요한 VPC, subnet, security group, task execution role, CloudWatch Logs, ECS service 구성을 만든다.

### ECR 고정 태그와 scan on push 설정

목표:

- `latest` 외에 Git commit 기반 고정 태그를 추가해 배포 이미지 추적성을 높인다.
- ECR repository의 scan on push를 켜서 이후 push되는 이미지에 대해 취약점 스캔을 실행할 수 있게 한다.

확인된 사실:

- 현재 Git commit short SHA는 `9f92ae6b0914`다.
- ECR repository `blog`의 scan on push를 `true`로 변경했다.
- 최초 ECR push 이미지는 `application/vnd.oci.image.index.v1+json` media type의 OCI image index였다.
- ECR basic image scan은 해당 OCI image index artifact에 대해 `UnsupportedImageTypeException`을 반환했다.
- `docker buildx build --platform linux/amd64 --provenance=false --load -t blog:latest .`로 단일 플랫폼 이미지를 다시 빌드했다.
- 재빌드한 `linux/amd64` 이미지는 로컬 컨테이너 런타임에서 주요 URL 모두 `200` 응답을 반환했다.
- ECR의 `latest`와 `9f92ae6b0914` 태그는 같은 digest를 가리킨다.

작업:

- ECR repository의 scan on push를 켰다.
- `blog:latest` 이미지를 `424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:9f92ae6b0914`로 태그했다.
- 최초 고정 태그 push 후 image scan 결과가 없는 것을 확인했다.
- 수동 scan을 시도했지만 OCI image index media type이 지원되지 않아 실패했다.
- scan 호환성을 위해 `linux/amd64` 단일 플랫폼 이미지를 다시 빌드했다.
- 새 이미지를 로컬에서 컨테이너로 실행해 `/api/health`와 주요 페이지 응답을 확인했다.
- ECR의 `latest`와 `9f92ae6b0914` 태그를 새 단일 플랫폼 이미지 digest로 갱신했다.
- ECR image scan findings를 조회했다.

검증:

```bash
aws ecr put-image-scanning-configuration \
  --repository-name blog \
  --image-scanning-configuration scanOnPush=true \
  --profile blog

docker buildx build --platform linux/amd64 --provenance=false --load -t blog:latest .
docker run --rm --detach --name blog-amd64-verify -p 3004:3000 blog:latest
docker stop blog-amd64-verify

docker tag blog:latest 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:latest
docker tag blog:latest 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:9f92ae6b0914
docker push 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:latest
docker push 424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:9f92ae6b0914

aws ecr describe-image-scan-findings \
  --repository-name blog \
  --image-id imageTag=9f92ae6b0914 \
  --profile blog
```

결과:

- ECR repository `blog`의 scan on push는 `true`다.
- 최종 ECR image digest는 `sha256:8e15251358de17ad184b16762d080ae048309bdf1fda8d99a6aaba875a9ca428`다.
- `latest`와 `9f92ae6b0914`가 같은 최종 digest를 가리킨다.
- 최종 image media type은 `application/vnd.oci.image.manifest.v1+json`이다.
- ECR image scan status는 `COMPLETE`다.
- ECR image scan finding 수는 `0`개다.

추론:

- ECS task definition은 `latest` 대신 `9f92ae6b0914` 태그를 참조하면 현재 배포 대상 이미지를 더 명확히 고정할 수 있다.
- `latest` 태그도 같은 digest를 가리키므로, 현재 시점에는 `latest`와 `9f92ae6b0914` 중 어느 태그를 사용해도 같은 이미지를 배포한다.
- 단일 플랫폼 `linux/amd64` 이미지는 ECS Fargate의 기본 Linux/x86_64 runtime platform과 맞는 배포 산출물이다.

제한 사항:

- Git commit tag는 코드 버전 추적에는 유리하지만, `docs/work-log.md`에 uncommitted 변경이 있으므로 현재 작업 트리는 clean 상태가 아니다.
- 더 엄밀한 재현성을 원하면 배포용 변경을 커밋한 뒤 새 commit SHA로 다시 image tag를 발급한다.

다음 작업:

- ECS/Fargate task definition에서 `424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:9f92ae6b0914` 이미지를 사용한다.
- ECS/Fargate 배포에 필요한 VPC, subnet, security group, task execution role, CloudWatch Logs, ECS service 구성을 만든다.

### 3단계: Fargate 일회성 task로 블로그 실행

목표:

- ECR에 push한 Docker 이미지를 ECS Fargate에서 실제로 실행하고 public IP로 HTTP 응답을 확인한다.

확인된 사실:

- 기본 VPC는 `vpc-030c376c0ab0744a1`이다.
- 사용한 subnet은 기본 VPC의 public subnet이다.
- ECS cluster 이름은 `blog-cluster`다.
- ECS task execution role 이름은 `blog-ecs-task-execution-role`이다.
- CloudWatch log group 이름은 `/ecs/blog`이다.
- security group 이름은 `blog-fargate-sg`이고 ID는 `sg-04c17775a3c7a5713`이다.
- task definition은 `blog:1`이다.
- 실행한 task ARN은 `arn:aws:ecs:ap-northeast-2:424503481518:task/blog-cluster/a07dd7ae25884538ba1af2548398c52f`다.
- task에 연결된 network interface는 `eni-0be4ccf1a67d86d2a`다.
- task public IP는 `43.201.67.139`다.
- security group은 검증 목적으로 `0.0.0.0/0`에서 TCP `3000` inbound를 허용한다.

작업:

- `blog-cluster` ECS cluster를 생성했다.
- `/ecs/blog` CloudWatch log group을 생성하고 retention을 7일로 설정했다.
- `blog-ecs-task-execution-role` IAM role을 생성했다.
- `AmazonECSTaskExecutionRolePolicy` managed policy를 task execution role에 연결했다.
- `blog-fargate-sg` security group을 생성했다.
- 검증용으로 TCP `3000` public inbound rule을 추가했다.
- `424503481518.dkr.ecr.ap-northeast-2.amazonaws.com/blog:9f92ae6b0914` 이미지를 사용하는 Fargate task definition `blog:1`을 등록했다.
- public IP 할당을 켠 Fargate task 1개를 실행했다.
- task가 `RUNNING` 상태가 될 때까지 기다렸다.
- CloudWatch Logs에서 Next.js server start log를 확인했다.
- public IP로 주요 URL의 HTTP 응답을 확인했다.

검증:

```bash
aws ecs create-cluster --cluster-name blog-cluster --profile blog
aws logs create-log-group --log-group-name /ecs/blog --profile blog
aws logs put-retention-policy --log-group-name /ecs/blog --retention-in-days 7 --profile blog
aws iam create-role --role-name blog-ecs-task-execution-role --profile blog
aws iam attach-role-policy \
  --role-name blog-ecs-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  --profile blog
aws ec2 create-security-group \
  --group-name blog-fargate-sg \
  --description 'Temporary public access for blog Fargate task on port 3000' \
  --vpc-id vpc-030c376c0ab0744a1 \
  --profile blog
aws ecs register-task-definition --family blog --profile blog
aws ecs run-task --cluster blog-cluster --launch-type FARGATE --task-definition blog:1 --profile blog
aws ecs wait tasks-running \
  --cluster blog-cluster \
  --tasks arn:aws:ecs:ap-northeast-2:424503481518:task/blog-cluster/a07dd7ae25884538ba1af2548398c52f \
  --profile blog
```

확인한 URL:

- `http://43.201.67.139:3000/api/health`
- `http://43.201.67.139:3000/`
- `http://43.201.67.139:3000/posts`
- `http://43.201.67.139:3000/posts/audio-editor-zoom-raf-throttling`
- `http://43.201.67.139:3000/tags/architecture`
- `http://43.201.67.139:3000/feed.xml`
- `http://43.201.67.139:3000/robots.txt`
- `http://43.201.67.139:3000/sitemap.xml`

결과:

- Fargate task는 `RUNNING` 상태다.
- 컨테이너 `blog`는 `RUNNING` 상태다.
- `/api/health`는 `200 application/json`으로 응답했다.
- `/`, `/posts`, 글 상세 페이지, 태그 페이지는 `200 text/html`로 응답했다.
- `/feed.xml`은 `200 application/rss+xml`로 응답했다.
- `/robots.txt`는 `200 text/plain`으로 응답했다.
- `/sitemap.xml`은 `200 application/xml`로 응답했다.
- CloudWatch Logs에서 Next.js `Ready` 로그를 확인했다.

추론:

- ECR image pull, ECS task execution role, Fargate runtime, public networking, container port `3000`, CloudWatch log delivery가 현재 구성에서 동작한다.
- public IP로 주요 URL이 `200`을 반환했으므로, DB 없이 파일 기반 블로그를 AWS Fargate에서 실행하는 최소 배포 목표는 충족했다.

제한 사항:

- 현재 구성은 ECS service가 아니라 일회성 Fargate task다. task가 중지되면 자동으로 새 task가 뜨지 않는다.
- public IP는 task lifecycle에 묶여 있으므로 task 재실행 시 바뀔 수 있다.
- HTTPS와 도메인 연결은 아직 없다.
- TCP `3000` 포트를 전체 공개하고 있으므로 운영용 공개 방식으로 보기 어렵다.
- task가 `RUNNING`인 동안 Fargate 비용이 발생한다.

다음 작업:

- 검증이 끝나면 비용 방지를 위해 일회성 task를 중지한다.
- 운영 형태로 전환하려면 Application Load Balancer와 ECS service를 구성한다.
- security group inbound를 load balancer에서 오는 트래픽으로 제한한다.

### Fargate 일회성 task 중지

목표:

- 검증용으로 실행한 Fargate task를 중지해 지속적인 Fargate 실행 비용을 멈춘다.

확인된 사실:

- 중지 대상 task ARN은 `arn:aws:ecs:ap-northeast-2:424503481518:task/blog-cluster/a07dd7ae25884538ba1af2548398c52f`다.
- task 중지 요청 후 desired status는 `STOPPED`로 바뀌었다.
- 최종 task status는 `STOPPED`다.
- task stopped time은 `2026-07-06T12:16:19.219000+09:00`다.
- 컨테이너 `blog`의 최종 status는 `STOPPED`다.
- 컨테이너 exit code는 `143`이다.

작업:

- 검증용 Fargate task에 stop 요청을 보냈다.
- task가 실제로 `STOPPED` 상태가 될 때까지 기다렸다.
- 최종 task와 container 상태를 조회했다.

검증:

```bash
aws ecs stop-task \
  --cluster blog-cluster \
  --task arn:aws:ecs:ap-northeast-2:424503481518:task/blog-cluster/a07dd7ae25884538ba1af2548398c52f \
  --reason 'Stop temporary validation task to avoid ongoing Fargate cost' \
  --profile blog

aws ecs wait tasks-stopped \
  --cluster blog-cluster \
  --tasks arn:aws:ecs:ap-northeast-2:424503481518:task/blog-cluster/a07dd7ae25884538ba1af2548398c52f \
  --profile blog
```

결과:

- 검증용 Fargate task는 중지됐다.
- 해당 task에 연결된 public IP 접속은 더 이상 유지되는 배포 주소로 볼 수 없다.

추론:

- Fargate compute와 task에 연결된 public IPv4 사용 비용은 task 중지 이후 추가로 누적되지 않는 상태와 일치한다.
- ECR image storage와 CloudWatch Logs storage처럼 task 실행과 독립적인 리소스 비용은 별도로 남을 수 있다.

### 검증용 AWS 리소스 삭제

목표:

- 비용이 계속 누적될 수 있는 검증용 AWS 리소스를 삭제한다.
- 직접 비용이 없는 구성 리소스도 혼동을 줄이기 위해 함께 정리한다.

확인된 사실:

- 정리 전 `blog-cluster`에는 실행 중인 task가 없었다.
- ECR repository `blog`가 존재했다.
- CloudWatch log group `/ecs/blog`이 존재했다.
- ECS task definition `blog:1`이 active 상태였다.
- security group `blog-fargate-sg`가 존재했다.
- IAM role `blog-ecs-task-execution-role`이 존재했다.

작업:

- ECR repository `blog`를 `--force` 옵션으로 삭제했다.
- CloudWatch log group `/ecs/blog`을 삭제했다.
- ECS task definition `blog:1`을 deregister해서 inactive 상태로 바꿨다.
- ECS cluster `blog-cluster`를 삭제했다.
- IAM role `blog-ecs-task-execution-role`에서 `AmazonECSTaskExecutionRolePolicy`를 detach했다.
- IAM role `blog-ecs-task-execution-role`을 삭제했다.
- security group `blog-fargate-sg`를 삭제했다.
- Elastic IP, NAT Gateway, Application Load Balancer가 없는 것을 확인했다.

검증:

```bash
aws ecs list-tasks --cluster blog-cluster --desired-status RUNNING --profile blog
aws ecr delete-repository --repository-name blog --force --profile blog
aws logs delete-log-group --log-group-name /ecs/blog --profile blog
aws ecs deregister-task-definition \
  --task-definition arn:aws:ecs:ap-northeast-2:424503481518:task-definition/blog:1 \
  --profile blog
aws ecs delete-cluster --cluster blog-cluster --profile blog
aws iam detach-role-policy \
  --role-name blog-ecs-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  --profile blog
aws iam delete-role --role-name blog-ecs-task-execution-role --profile blog
aws ec2 delete-security-group --group-id sg-04c17775a3c7a5713 --profile blog
```

결과:

- 실행 중인 ECS task는 없다.
- ECR repository `blog`는 삭제됐다.
- CloudWatch log group `/ecs/blog`은 삭제됐다.
- ECS cluster `blog-cluster`는 inactive 상태다.
- security group `blog-fargate-sg`는 조회되지 않는다.
- IAM role `blog-ecs-task-execution-role`은 조회되지 않는다.
- Elastic IP 목록은 비어 있다.
- NAT Gateway 목록은 비어 있다.
- Application Load Balancer 목록은 비어 있다.

추론:

- 이번 검증을 위해 생성한 리소스 중 지속 비용을 만들 가능성이 큰 항목은 정리됐다.
- 이미 실행된 Fargate task 시간, task에 붙었던 public IPv4 사용 시간, 삭제 전 ECR storage와 CloudWatch Logs 사용량은 소급해서 없앨 수 없다.
