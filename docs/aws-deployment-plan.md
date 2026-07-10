# AWS Amplify 정적 호스팅 배포

## Goal

Markdown 기반 Next.js 블로그를 Node.js 서버, Application Load Balancer, RDS, NAT Gateway 없이 AWS Amplify Hosting에 배포한다.

이 문서에서 **정적 export**는 `next build`가 배포 가능한 파일을 `out` 디렉터리에 생성하는 과정을 뜻한다. **정적 호스팅**은 그 파일을 요청 시점의 서버 렌더링 없이 Content Delivery Network(CDN)에서 전달하는 방식을 뜻한다.

## Prerequisites

- Node.js 22
- pnpm 11.9.0
- GitHub의 `whizzkid1452/blog` 저장소에 접근할 수 있는 계정
- AWS 계정과 Amplify Hosting 사용 권한
- 커스텀 도메인을 사용하는 경우 실제 공개 URL

현재 AWS 계정이 Paid plan이어도 플랜 자체의 월정액이 발생하는 것은 아니다. Amplify의 빌드, 저장, 데이터 전송 사용량에 따라 종량제 비용이 발생하며, 적용 가능한 AWS 크레딧이 있으면 해당 비용에 먼저 사용된다.

## Architecture

```text
GitHub main branch
  ↓ push
AWS Amplify build
  ↓ pnpm build
out directory
  ↓ deploy
Amplify Hosting CDN
  ↓ HTTPS
Visitor
```

### 확인된 사실

- 공개 글과 태그 데이터는 `content/posts`의 Markdown 파일에 있다.
- 글 상세와 태그 경로는 `generateStaticParams()`로 빌드 시점에 결정된다.
- `next.config.ts`는 `output: 'export'`를 사용한다.
- `pnpm build`는 공개 페이지, RSS, sitemap, robots, Open Graph 이미지를 `out`에 생성한다.
- `amplify.yml`은 `out`을 배포 산출물로 지정한다.

### 추론

- 현재 기능에는 요청마다 실행되는 Node.js 서버가 필요하지 않다.
- ECS, Load Balancer, RDS, NAT Gateway를 제거하면 방문자가 없어도 발생하는 시간 기반 비용의 위험이 줄어든다.
- Amplify의 Next.js SSR 지원 버전은 이 배포의 필요조건이 아니다. Amplify가 받는 입력은 Next.js 서버가 아니라 정적 export 산출물이기 때문이다.

### 가정

- 운영 브랜치는 `main`이다.
- 글 작성과 수정은 Markdown 변경 후 재배포하는 방식으로 진행한다.
- 로그인, 관리자 편집기, 댓글 저장과 같은 서버 기능은 현재 범위에 포함하지 않는다.

## Step-by-Step Guide

### 1. 로컬 정적 export 검증

PowerShell에서는 다음 명령을 실행한다.

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://example.com'
pnpm install --frozen-lockfile
pnpm build
```

Bash 계열 셸에서는 다음 명령을 실행한다.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com pnpm install --frozen-lockfile
NEXT_PUBLIC_SITE_URL=https://example.com pnpm build
```

빌드가 끝나면 `out/index.html`, `out/posts.html`, `out/feed.xml`, `out/sitemap.xml`이 존재해야 한다.

### 2. 정적 산출물 미리보기

```bash
pnpm dlx serve@14.2.5 out
```

`http://localhost:3000`에서 다음 경로를 확인한다.

- `/`
- `/posts`
- 공개 글의 `/posts/{slug}`
- 공개 태그의 `/tags/{tag}`
- `/feed.xml`
- `/sitemap.xml`
- `/robots.txt`

### 3. GitHub 저장소 연결

1. AWS 콘솔에서 **Amplify**를 연다.
2. **Create new app** 또는 **Deploy an app**을 선택한다.
3. Git 공급자로 **GitHub**을 선택한다.
4. `whizzkid1452/blog` 저장소와 `main` 브랜치를 선택한다.
5. 저장소 루트의 `amplify.yml`을 빌드 설정으로 사용하는지 확인한다.

이 저장소는 단일 애플리케이션이므로 Amplify의 **My app is a monorepo** 옵션을 선택하지 않는다.

### 4. 빌드 설정 확인

`amplify.yml`은 다음 작업을 수행한다.

1. Node.js 22를 선택한다.
2. pnpm 11.9.0으로 의존성을 설치한다.
3. `pnpm build`를 실행한다.
4. `out` 디렉터리를 배포한다.

커스텀 `NEXT_PUBLIC_SITE_URL`이 없으면 Amplify가 제공하는 `AWS_BRANCH`와 `AWS_APP_ID`로 기본 URL을 구성한다.

```text
https://{branch}.{app-id}.amplifyapp.com
```

따라서 첫 배포에서도 canonical URL, sitemap URL, Open Graph URL을 만들 수 있다.

### 5. 첫 배포

1. Amplify 설정 검토 화면에서 **Save and deploy**를 선택한다.
2. Provision, Build, Deploy, Verify 단계가 모두 성공했는지 확인한다.
3. Amplify가 제공한 `amplifyapp.com` 주소에서 블로그를 연다.

빌드가 실패하면 로그에서 가장 먼저 `pnpm install`, `NEXT_PUBLIC_SITE_URL`, `pnpm build` 단계를 구분해 확인한다.

### 6. 커스텀 도메인 연결

커스텀 도메인이 없다면 이 단계를 건너뛴다.

1. Amplify의 **Hosting → Custom domains**에서 도메인을 연결한다.
2. Amplify의 환경 변수에 `NEXT_PUBLIC_SITE_URL=https://실제-도메인`을 추가한다.
3. `main` 브랜치를 다시 배포한다.
4. 페이지의 canonical, Open Graph, sitemap URL이 커스텀 도메인을 가리키는지 확인한다.

`NEXT_PUBLIC_SITE_URL`은 공개 URL이므로 secret이 아니다. 비밀번호나 API key는 이 접두사의 환경 변수에 저장하지 않는다.

### 7. 비용 알림 확인

1. AWS Billing의 **Budgets**에서 월 예산 알림을 유지한다.
2. **Credits**에서 남은 크레딧과 만료일을 확인한다.
3. **Bills**에서 Amplify의 실제 사용 비용과 크레딧 적용 결과를 확인한다.

Budget은 비용 발생을 차단하는 장치가 아니라 임계값 알림이다.

### Verify Final Result

로컬 검증:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

배포 검증:

- 첫 화면과 글 목록이 HTTP 200으로 응답한다.
- 글 상세와 태그 페이지가 새로고침 후에도 열린다.
- `/feed.xml`이 RSS XML을 반환한다.
- `/sitemap.xml`에 공개 글과 태그 URL이 있다.
- `/robots.txt`의 sitemap URL이 실제 배포 주소를 가리킨다.
- 글 상세 HTML의 canonical URL과 Open Graph URL이 실제 배포 주소를 가리킨다.

## FAQ

### 글을 수정하면 서버를 재시작해야 하는가

아니다. Markdown 변경을 `main`에 반영하면 Amplify가 새 정적 파일을 빌드하고 배포한다.

### `/api/health`가 제거된 이유는 무엇인가

정적 호스팅에는 상시 실행되는 애플리케이션 프로세스가 없다. 따라서 프로세스 생존 여부를 확인하는 health endpoint가 성립하지 않는다. Amplify의 배포 상태와 공개 URL 응답으로 가용성을 확인한다.

### DB를 나중에 추가할 수 있는가

가능하지만 정적 호스팅 전환과는 별개의 변경 목적이다. 요청 시점 DB 조회가 필요해지면 API 또는 서버 런타임의 필요조건을 먼저 정의하고 별도 PR에서 배포 구조를 결정한다.

### 사용하지 않을 때 비용을 중단하려면 어떻게 하는가

Amplify 콘솔의 앱 설정에서 앱을 삭제한다. GitHub 저장소를 삭제하는 것만으로 AWS 리소스가 자동 삭제된다고 가정하면 안 된다.

## References

- [Deploy a Next.js app to Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/getting-started-next.html)
- [Amplify environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Connecting a custom domain](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)
