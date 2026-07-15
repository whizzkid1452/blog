# AWS EC2 `t4g.small` 배포

## Goal

Next.js standalone 서버를 ARM64 Docker 이미지로 빌드하고 EC2 `t4g.small` 한 대에 배포한다. `main` 브랜치가 갱신되면 GitHub Actions가 같은 절차를 자동 실행한다.

이 구성에서 애플리케이션 서버는 Next.js의 `server.js` 프로세스다. 데이터베이스와 인증은 현재 Supabase를 계속 사용하며 EC2에 직접 설치하지 않는다.

## Prerequisites

- Docker
- AWS CLI를 실행할 수 있는 AWS 계정과 권한
- 인터넷 게이트웨이 경로가 있는 VPC와 퍼블릭 서브넷 1개
- `devlog.dropai.site`의 DNS 레코드를 변경할 권한
- GitHub 저장소의 Actions 실행 권한

## Architecture

```text
사용자
  ↓ HTTPS
Elastic IP
  ↓
Caddy
  ↓ 127.0.0.1:3000
EC2 t4g.small의 Next.js 컨테이너

main push
  ↓ GitHub OIDC 임시 자격 증명
GitHub Actions
  ↓ ARM64 Docker 이미지
Amazon ECR
  ↓ AWS Systems Manager 명령
EC2
```

- [`shared-stack.yml`](../infra/shared-stack.yml)은 ECR 저장소와 GitHub OpenID Connect(OIDC) 공급자를 관리한다.
- [`ec2-stack.yml`](../infra/ec2-stack.yml)은 EC2, 20GB gp3 볼륨, Elastic IP, 보안 그룹과 IAM 역할을 관리한다.
- 80·443 포트만 외부에 공개한다. SSH 포트는 열지 않고 AWS Systems Manager(SSM)로 명령을 실행한다.
- Caddy가 TLS 인증서 발급과 갱신, HTTPS 요청의 reverse proxy를 담당한다.
- `/api/health`는 Next.js 프로세스가 HTTP 요청에 응답하는지만 확인한다. Supabase 연결 상태는 확인하지 않는다.

## Step-by-Step Guide

### 1. 로컬 검증

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
NEXT_PUBLIC_SITE_URL=https://devlog.dropai.site pnpm build
```

ARM64 이미지를 빌드할 수 있는 환경에서는 컨테이너도 확인한다.

```bash
docker buildx build \
  --platform linux/arm64 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://devlog.dropai.site \
  --load \
  --tag blog:arm64 \
  .
```

`NEXT_PUBLIC_SITE_URL`은 공개 URL이다. 비밀번호, 데이터베이스 연결 문자열, 서버 전용 API key를 build argument로 전달하지 않는다.

### 2. 공유 리소스 생성

현재 운영 환경은 기존 스택 이름인 `blog-ecs`에서 ECR 저장소와 GitHub OIDC 공급자만 관리한다.

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name blog-ecs \
  --template-file infra/shared-stack.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

ECR 저장소는 이미지 태그 변경을 허용하지 않는다. Git 커밋과 CPU 아키텍처를 구분할 수 있도록 자동 배포는 `<commit-sha>-arm64` 태그를 사용한다.

### 3. EC2 인프라 생성

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name blog-ec2 \
  --template-file infra/ec2-stack.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    VpcId=<vpc-id> \
    PublicSubnetId=<public-subnet-id>
```

스택 생성이 끝나면 인스턴스 ID와 Elastic IP를 확인한다.

```bash
aws cloudformation describe-stacks \
  --region us-east-1 \
  --stack-name blog-ec2 \
  --query 'Stacks[0].Outputs'
```

### 4. 첫 이미지 배포

GitHub Actions의 `EC2 프로덕션 배포` workflow를 수동 실행한다. Workflow는 다음 순서로 동작한다.

1. GitHub OIDC token으로 `blog-ec2-deploy-role`의 임시 자격 증명을 받는다.
2. `linux/arm64` Docker 이미지를 빌드해 ECR에 저장한다.
3. `Application=blog` 태그가 있는 실행 중인 EC2 인스턴스가 정확히 한 대인지 확인한다.
4. SSM으로 [`deploy-ec2.sh`](../infra/deploy-ec2.sh)를 실행한다.
5. 새 컨테이너의 `/api/health`를 최대 60초 동안 확인한다.

상태 검사가 실패하면 배포 스크립트가 직전 컨테이너 이미지를 다시 실행한다. 복구할 이전 이미지가 없으면 실패한 컨테이너를 제거하고 workflow를 실패 처리한다.

### 5. DNS 전환

첫 배포와 상태 검사가 성공한 뒤 `devlog.dropai.site`의 A 레코드를 `blog-ec2` 스택의 Elastic IP로 설정한다.

```text
Type: A
Name: devlog
Value: <ElasticIpAddress>
```

DNS가 새 IP를 반환하면 Caddy가 `devlog.dropai.site`의 TLS 인증서를 자동으로 발급한다. DNS 전파 중에는 기존 주소가 일부 resolver에 남을 수 있다.

### 6. `main` 자동 배포

[`deploy-ec2.yml`](../.github/workflows/deploy-ec2.yml)은 `main` push와 수동 실행을 처리한다. PR을 `main`에 merge하면 새 ARM64 이미지를 만들고 같은 EC2 인스턴스에 자동 배포한다.

동시에 여러 배포가 시작되어도 `production-ec2` concurrency group에서 순서대로 실행한다. 실행 중인 배포는 새 push 때문에 취소되지 않는다.

## Verify Final Result

CloudFormation template을 확인한다.

```bash
aws cloudformation validate-template --template-body file://infra/shared-stack.yml
aws cloudformation validate-template --template-body file://infra/ec2-stack.yml
```

EC2와 SSM 연결 상태를 확인한다.

```bash
aws ec2 describe-instances \
  --filters Name=tag:Application,Values=blog Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType,Architecture,State.Name]'

aws ssm describe-instance-information \
  --query 'InstanceInformationList[].[InstanceId,PingStatus]'
```

공개 주소를 확인한다.

```bash
curl --fail https://devlog.dropai.site/api/health
curl --head https://devlog.dropai.site/
```

완료 조건:

- EC2 인스턴스가 `t4g.small`, `arm64`, `running`으로 조회된다.
- SSM의 `PingStatus`가 `Online`이다.
- `/api/health`가 `{"status":"ok"}`를 반환한다.
- `main` push의 `EC2 프로덕션 배포` workflow가 성공한다.
- ECR 이미지 태그가 배포한 커밋의 `<commit-sha>-arm64`와 일치한다.

## 운영 시 주의사항

- 이 구성은 단일 EC2 인스턴스다. 인스턴스 장애 시 자동으로 다른 인스턴스로 전환하지 않는다.
- 배포 중 기존 컨테이너를 중지한 뒤 새 컨테이너를 시작하므로 짧은 응답 중단이 발생할 수 있다.
- EC2, EBS, Elastic IP와 데이터 전송에는 각 서비스 요금이 적용된다.
- 서버 비밀 값이 필요해지면 AWS Secrets Manager 또는 SSM Parameter Store에서 런타임에 읽도록 별도 구현해야 한다.
- 배포 실패는 이미지 빌드, ECR push, SSM 명령, 컨테이너 상태 검사 단계로 구분해 GitHub Actions 로그에서 확인한다.

## FAQ

### PR을 merge하면 자동으로 배포되는가?

PR merge로 `main`이 갱신되면 자동 배포된다. PR 브랜치의 push는 프로덕션 배포를 실행하지 않는다.

### EC2에 SSH로 접속해야 하는가?

아니다. 22번 포트는 열려 있지 않으며 배포와 점검은 SSM을 사용한다.

### 데이터베이스도 EC2에서 실행되는가?

아니다. 현재 애플리케이션의 데이터베이스와 인증은 Supabase를 사용한다. EC2는 Next.js 애플리케이션과 Caddy만 실행한다.
