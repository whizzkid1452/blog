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
