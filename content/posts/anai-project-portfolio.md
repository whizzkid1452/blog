---
title: 'AnAI 프로젝트 포트폴리오'
description: 'AnAI Media Editor, Kit + Tool, AnAI Main에서 해결한 상태 관리, 미디어 처리, 서비스 안정성, 배포 자동화 경험을 정리합니다.'
date: '2026-07-22'
tags: ['portfolio', 'frontend', 'electron', 'architecture']
draft: false
visibility: public
---

## [sort1] 1. AnAI Media Editor

**GitHub**: [anai-studio](https://github.com/AnAIAudio/anai-studio), [voix-on/apps/voix-studio](https://github.com/AnAIAudio/voix-on/tree/main/apps/voix-studio)

**기간**

**Site**

### 개요

웹 브라우저와 Electron에서 실행되는 멀티미디어 편집 서비스입니다. 평균 1시간 분량, 15개 트랙의 프로젝트를 처리합니다.

### 역할

프론트엔드 2인 팀에서 웹 브라우저 버전 개발을 리드했습니다. Electron 버전은 프론트엔드 2명, 백엔드 3명과 협업했습니다.

### Skills

React, Electron, Zustand, TanStack Query, IndexedDB

Web Worker, WebCodecs, FFmpeg, Sentry

### 주요 기여

#### 레거시 상태 구조와 편집 이력 통합

**AS-IS**

프로젝트 상태가 창과 프로세스에 나뉘어 있어 같은 프로젝트가 화면마다 다르게 보일 수 있었습니다. 프로젝트, 실행 중 상태, UI 상태의 경계도 명확하지 않아 저장 누락이나 수정 범위 확대 위험이 있었습니다. 클립 이동, 삭제, 분할 기능은 서로 다른 방식으로 상태를 변경해 여러 편집을 한 번에 되돌리기 어려웠고, 같은 변경이 타임라인, 미리보기, Export에 다르게 반영되는 문제도 있었습니다.

**TO-BE**

여러 창이 하나의 상태를 사용해야 했기 때문에 Electron Main Process를 프로젝트 상태의 단일 관리 지점으로 정하고, 각 화면은 IPC(Inter-Process Communication)로 변경을 요청하도록 구성했습니다. 프로젝트, 실행 중 상태, UI 상태를 분리한 뒤 Zustand, `useState`, Context의 역할을 정했습니다.

클립 이동, 삭제, 분할은 실행과 되돌리기 정보를 가진 Command로 통합하고 History에서 순서대로 관리했습니다. 38개 소비자는 필요한 값만 구독하도록 Selector 기반 구조로 전환했습니다.

**그 결과 편집 변경이 타임라인, 미리보기, Export에 일관되게 반영됐고, 상태 갱신과 React 리렌더 범위가 줄었습니다.**

![Electron Main Process의 프로젝트 상태와 여러 편집 창의 Command·Selector 흐름](/images/anai-project-portfolio/editor-state-command-flow.svg)

_Command는 Electron Process 경계를 통과하고, Selector는 각 Renderer의 갱신 범위를 제한합니다._

#### Local-first 저장과 Cloud Revision 관리

**AS-IS**

서버 업로드가 끝나야 저장이 완료돼 네트워크가 끊기면 편집을 계속하기 어려웠습니다. 프로젝트를 바꾼 뒤 이전 비동기 요청이 완료되면 그 결과가 현재 프로젝트에 반영될 수 있었습니다. 분산·오프라인 환경에서 변경 이력과 동시 수정 분기를 구분할 기준도 필요했습니다.

**TO-BE**

네트워크 상태와 관계없이 편집하려면 로컬 저장이 먼저 완료돼야 한다고 판단했습니다. 프로젝트 문서와 미디어를 IndexedDB에 먼저 저장하고, Cloud Sync를 별도 작업으로 분리했습니다. 비동기 요청이 끝나면 작업을 시작한 프로젝트 세션과 Cloud Revision이 현재 값과 같은지 검사했습니다.

Revision ID는 UUID를 사용하고 부모 Revision ID를 함께 기록했습니다. **이를 통해 네트워크 연결 없이 편집을 지속할 수 있게 했고, 이전 요청의 덮어쓰기와 Revision ID 충돌 위험을 낮췄습니다. 변경 이력과 동시 수정 분기도 추적할 수 있게 됐습니다.**

![IndexedDB Local-first 저장과 세션·Revision 검사 및 UUID 부모 Revision chain](/images/anai-project-portfolio/editor-local-first-revision-chain.svg)

_로컬 저장을 먼저 완료하고, 응답의 Session과 Revision이 일치할 때만 Cloud 결과를 반영합니다._

#### 썸네일·타임라인·미디어 가져오기 성능 개선

**AS-IS**

긴 영상의 프레임을 Main Thread에서 추출해 첫 썸네일 표시가 늦고 편집 UI가 함께 느려졌습니다. 클립을 드래그할 때는 모든 Pointer 이벤트마다 React 상태를 변경해 같은 화면 갱신 주기 안에서 계산과 렌더링이 반복됐습니다. 브라우저마다 지원하는 미디어 형식이 달라 일부 파일의 오디오를 처리하지 못했습니다.

**TO-BE**

썸네일 디코딩은 UI 작업과 분리하기 위해 Web Worker와 WebCodecs로 옮기고, 현재 화면에 필요한 구간부터 처리했습니다. **첫 표시 시간은 `6.26초 → 2.82초`로 55.0% 단축됐고, Main Thread busy 비율은 `66% → 11%`로 83.3% 감소했습니다.**

드래그 중에는 위치를 메모리에 보관하고 `requestAnimationFrame`마다 Overlay만 갱신한 뒤, 드래그가 끝날 때 최종 상태를 반영했습니다. **React Profiler의 `actualDuration`은 `2.87ms → 1.98ms`로 31.0% 감소했습니다.** 이 값은 React 렌더링 시간이며 Pointer 처리와 브라우저 화면 그리기를 포함한 전체 응답 시간은 아닙니다.

미디어 가져오기는 WebCodecs를 우선 사용하고, 지원하지 않는 형식은 FFmpeg로 처리하는 Fallback을 적용했습니다. **기본 경로의 처리 속도를 유지하면서 브라우저별 형식 차이를 보완했습니다.**

![첫 썸네일 표시 시간, Main Thread busy 비율, React actualDuration 전후 비교](/images/anai-project-portfolio/editor-performance-comparison.svg)

_Thumbnail 지표는 브라우저 작업을 포함하고, React actualDuration은 React 렌더링 시간만 측정합니다._

![Web Worker 썸네일 처리, requestAnimationFrame 드래그, FFmpeg Fallback 흐름](/images/anai-project-portfolio/editor-media-processing-flow.svg)

_Thumbnail Decode, Drag 피드백, 미디어 가져오기는 서로 다른 처리 방식을 사용합니다._

#### 대규모 오디오 처리의 응답성과 안정성 개선

**AS-IS**

대량의 오디오 데이터를 개별 IPC로 전송하고 여러 작업을 동시에 실행하면서 호출 비용과 작업 경합이 커졌습니다. 676개 데이터를 처리하는 데 15.58초가 걸렸고, Long Task 누적 시간은 2.24초였습니다. 내부 반영 작업 오류는 78건, 메모리 Peak는 2.32GB로 측정됐습니다.

**TO-BE**

IPC 호출 횟수와 동시 실행량을 함께 줄여야 했습니다. 여러 데이터를 Bulk IPC로 묶고 동시 작업 수를 제한했으며, 반복 할당하던 버퍼는 재사용했습니다. UI 작업과 겹치는 처리는 작업 큐로 분산해 한 번에 Main Thread를 오래 점유하지 않도록 했습니다.

**적용 후 676개 처리 시간은 `15.58초 → 13.08초`로 16.1% 단축됐고, Long Task 누적 시간은 `2.24초 → 0.38초`로 82.8% 감소했습니다. 내부 반영 작업 오류는 `78건 → 0건`, 메모리 Peak는 `2.32GB → 2.12GB`로 줄었습니다.**

![676개 오디오 데이터의 처리 시간, Long Task, 오류 건수, 메모리 Peak 전후 비교](/images/anai-project-portfolio/editor-audio-processing-comparison.svg)

_같은 676개 데이터로 적용 전후를 비교했습니다._

![Bulk IPC, 동시 작업 수 제한, 작업 큐, 버퍼 재사용 처리 흐름](/images/anai-project-portfolio/editor-audio-processing-flow.svg)

_Bulk 전송, 동시 작업 수 제한, 작업 Queue, Buffer 재사용이 서로 다른 비용을 줄입니다._

#### OS 환경을 고려한 Export 안정화

**AS-IS**

장시간 오디오를 WAV로 만들 때 전체 출력 크기의 `ArrayBuffer`를 한 번에 할당해 저사양 PC에서 `RangeError: Array buffer allocation failed`가 발생했습니다. AAF(Advanced Authoring Format)는 개발 환경에서는 생성됐지만 macOS 사용자 환경에서 Structured Storage backend가 등록되지 않아 생성이 중단됐습니다.

**TO-BE**

WAV는 큰 연속 메모리 할당을 피하기 위해 오디오를 나눠 인코딩하고 각 결과를 `BlobPart`로 보관한 뒤 하나의 `Blob`으로 합쳤습니다. AAF는 필요한 Runtime과 Library를 앱에 포함하고, macOS Code Signing을 적용했습니다.

WAV와 AAF의 Export 경로를 하나로 관리하고 Production Build 전에 실제 파일을 만드는 Smoke Test와 서명 검증을 실행했습니다. **그 결과 저사양 PC의 장시간 WAV Export 실패를 해결했고, AAF Runtime 누락이나 잘못된 패키징을 배포 전에 확인할 수 있게 했습니다.**

![분할 Blob 기반 WAV 인코딩과 macOS AAF 패키징 및 검증 과정](/images/anai-project-portfolio/editor-export-stability-flow.svg)

_WAV는 큰 연속 할당을 피하고, AAF는 macOS Runtime 포함 여부와 서명을 실제 파일로 검증합니다._

#### 장애 관측·격리·복구 구조 구축

**AS-IS**

사용자 환경에서 발생한 오류의 범위와 재현 조건을 확인하기 어려웠습니다. 한 탭의 렌더링 오류가 앱 전체 오류로 이어졌고, 서버 요청이 실패한 뒤에는 TanStack Query의 오류 상태가 남아 화면만 다시 열어도 복구되지 않았습니다.

**TO-BE**

Sentry에 오류 위치, 실행 환경, 화면 경로를 기록했습니다. Error Boundary는 탭 단위로 배치하고, 다시 시도할 때는 Error Boundary와 TanStack Query의 오류 상태를 함께 초기화했습니다. **그 결과 장애 범위와 재현 조건을 확인할 수 있게 됐고, 한 기능의 오류가 다른 편집 기능으로 번지는 범위를 줄였습니다. 앱을 재실행하지 않고 실패한 기능도 복구할 수 있게 됐습니다.**

배포 코드에는 난독화를 적용했습니다. 이는 코드 분석을 차단하는 수단은 아니지만, **핵심 로직을 그대로 읽고 복제하는 난이도를 높여 기술 자산 노출 위험을 줄였습니다.**

![Sentry 관측, 탭 단위 Error Boundary, TanStack Query 오류 복구 흐름](/images/anai-project-portfolio/editor-observability-recovery-flow.svg)

_Telemetry는 재현 조건을 좁히고, 탭 단위 Boundary는 화면 장애 범위를 제한합니다._

## [sort1] 2. Kit + Tool

**GitHub**: [voix-kit](https://github.com/AnAIAudio/voix-kit), [edu-anai](https://github.com/AnAIAudio/edu_anai)

**기간**

**Site**

### 개요

AI 음원 생성·편집·공유 서비스입니다.

### 역할

### Skills

React, IndexedDB, HTMLMediaElement, Web Share API, GA4, Sentry

### 주요 기여

#### 생성 작업 복구와 중복 요청 방지

**AS-IS**

네트워크가 끊기거나 화면을 다시 열면 진행 중인 생성 요청을 이어가기 어려웠습니다. 재시도 과정에서 같은 생성 요청이 중복 실행될 수 있었고, Preview와 Final 결과의 완료 조건을 화면마다 다르게 관리해 화면과 서버 상태가 어긋났습니다. 여러 화면이 같은 작업을 반복 조회하는 문제도 있었습니다.

**TO-BE**

생성 요청과 서버 작업 식별자는 IndexedDB에 저장하고, 같은 요청을 다시 보내도 하나의 작업으로 처리하도록 멱등성 식별자를 사용했습니다. **그 결과 화면을 다시 열어도 진행 상태를 복원할 수 있게 됐고, 중복 생성과 불필요한 서버 작업을 막았습니다.**

Preview와 Final을 하나의 생성 작업 상태로 통합하고, 서버 작업이 처리 중일 때만 Polling하도록 조건을 한곳에서 관리했습니다. **화면과 서버의 상태 불일치를 막고 같은 작업의 중복 조회를 줄였습니다.**

![IndexedDB 요청 복구, 멱등성 식별자, Preview와 Final 생성 작업 상태 변화](/images/anai-project-portfolio/kit-generation-recovery-state.svg)

_멱등성 Key는 중복 요청을 같은 작업으로 처리하고, Server 작업 처리 중에만 Polling합니다._

#### 미디어 재생 상태와 리소스 생명주기 통합

**AS-IS**

오디오, 비디오, 멀티트랙이 재생 상태와 위치를 각각 관리해 미리 듣기와 결과 영상의 위치가 달라졌습니다. 파일을 바꾸거나 화면을 이동한 뒤에도 이전 미디어 객체, Object URL, 이벤트, 타이머가 남아 장시간 사용 시 메모리와 성능에 영향을 줄 수 있었습니다. 모바일 브라우저에서는 자동 재생 정책 때문에 재생이 실패하거나 위치가 초기화됐습니다.

**TO-BE**

오디오, 비디오, 멀티트랙의 재생, 일시 정지, 위치 이동을 하나의 재생 상태로 관리했습니다. 파일 변경과 화면 종료 시 미디어 인스턴스, Object URL, 이벤트, 타이머를 함께 정리하도록 생명주기를 통합했습니다.

모바일에서는 사용자 입력 이후에 재생을 시작하고, 실제 재생 성공 후 UI 상태를 변경했습니다. **이를 통해 매체별 재생 위치 불일치를 줄이고 반복 재생과 파일 변경 시 남던 브라우저 리소스를 정리했습니다.**

![오디오, 비디오, 멀티트랙의 통합 재생 상태와 브라우저 리소스 생명주기](/images/anai-project-portfolio/kit-playback-resource-lifecycle.svg)

_파일과 화면 생명주기에 맞춰 Resource를 정리하고, Mobile은 사용자 입력과 실제 재생 성공을 기다립니다._

#### 결제·구독 상태 전이와 실패 복구

**AS-IS**

구독의 즉시 변경, 예약 변경, 예약 취소, 비례 정산이 한 흐름에 섞여 현재 상태와 결제 결과를 구분하기 어려웠습니다. 결제 버튼의 중복 실행이나 주문 동기화 실패가 발생하면 중복 결제 또는 결제 정보와 구독 상태의 불일치로 이어질 수 있었습니다. 구독 만료와 크레딧 부족도 생성 요청 이후에 확인되는 경로가 있었습니다.

**TO-BE**

적용 시점과 정산 방식이 다른 구독 변경을 각각의 상태 전이로 분리했습니다. 결제 진행 중에는 같은 주문을 다시 실행하지 못하게 하고, 주문 동기화 실패를 감지하면 재동기화하는 복구 경로를 구성했습니다.

구독 만료와 크레딧 부족은 생성 화면에 진입할 때 먼저 검사했습니다. **이를 통해 현재 구독 상태와 결제 결과를 구분해 보여주고, 중복 결제와 생성 도중 실패할 위험을 줄였습니다.**

![즉시 변경, 예약 변경, 예약 취소, 비례 정산과 주문 복구 흐름](/images/anai-project-portfolio/kit-subscription-payment-flow.svg)

_적용 시점이 다른 전이를 구분하고, 진행 중인 같은 주문의 중복 실행을 막습니다._

#### 공유·다운로드 호환성과 중복 실행 개선

**AS-IS**

Web Share API의 지원 범위와 파일 크기 제한이 브라우저와 기기마다 달랐습니다. 잘못된 MIME 타입 때문에 모바일 공유가 실패했고, 공유 버튼을 빠르게 여러 번 누르면 공유창과 파일 요청이 중복됐습니다.

**TO-BE**

파일 공유 가능 여부와 크기를 확인한 뒤 Web Share API를 우선 사용하고, 지원하지 않는 환경에서는 링크 공유와 다운로드를 제공했습니다. 실제 파일 형식에 맞게 MIME 타입을 보정하고, 준비한 파일은 결과 식별자별로 캐시했습니다. 공유가 진행 중이면 새 요청을 만들지 않고 기존 요청을 사용했습니다.

**적용 후 중복 실행 시 네트워크 요청이 50% 이상 감소했고, 캐시된 파일의 준비 시간은 `209ms → 102ms`로 51.2% 단축됐습니다.**

![파일 공유 가능 여부에 따라 링크 공유와 다운로드로 이어지는 Fallback](/images/anai-project-portfolio/kit-share-fallback-flow.svg)

_MIME Type과 파일 크기를 먼저 검사하고, 지원하지 않는 환경에는 링크 공유와 다운로드를 제공합니다._

![공유 중복 실행의 네트워크 요청 감소율과 캐시된 파일 준비 시간 비교](/images/anai-project-portfolio/kit-share-performance-comparison.svg)

_Network 개선은 하한값이고, Cache된 파일 준비 시간은 측정값입니다._

#### 생성·미디어 장애 관측 체계 구축

**AS-IS**

콘솔 로그만으로는 생성과 미디어 오류가 발생한 단계, 브라우저 환경, 사용자 영향 범위를 함께 확인하기 어려웠습니다.

**TO-BE**

GA4에는 생성 단계와 미디어 실패 이벤트를 기록하고, Sentry에는 오류 위치, 브라우저 환경, 화면 경로를 기록했습니다. **두 기록을 함께 확인해 장애가 발생한 구간과 영향 범위를 파악하고 대응 우선순위를 정할 수 있는 기반을 마련했습니다.**

![GA4 생성·미디어 이벤트와 Sentry 오류 추적을 함께 사용하는 관측 흐름](/images/anai-project-portfolio/kit-observability-flow.svg)

_GA4는 영향받은 여정 단계를, Sentry는 실패의 기술 Context를 기록합니다._

## [sort1] 3. AnAI Main

**GitHub**: [anai-main](https://github.com/AnAIAudio/anai-main)

**기간**

**Site**

### 개요

다국어 브랜드 랜딩·콘텐츠 관리 시스템(Content Management System, CMS) 뉴스 서비스입니다.

### 역할

비즈니스 요구사항 구체화, Next.js 프론트엔드 개발, CMS 연동, 검색엔진 최적화(Search Engine Optimization, SEO), AWS 배포 자동화를 담당했습니다.

### Skills

Next.js App Router, Strapi, Nginx, Docker, GitHub Actions, AWS ECR, JSON-LD

### 주요 기여

#### 다국어 SEO와 콘텐츠 전송 구조 구축

**AS-IS**

언어별 URL과 검색 정보를 일관되게 관리하기 어려웠고, 뉴스 URL을 바꾸면 기존 검색 결과와 외부 공유 링크가 끊겼습니다. Sitemap과 Robots를 직접 관리해 새 콘텐츠의 검색 노출 설정을 빠뜨릴 수 있었습니다. 정적 자산과 HTML에 같은 캐시 정책을 적용해 변경된 콘텐츠가 늦게 반영되거나 불필요한 전송량이 발생했습니다.

**TO-BE**

Next.js App Router에서 다국어 라우팅과 언어별 Meta Tag, Canonical URL을 함께 관리했습니다. CMS 뉴스 URL을 다시 설계하면서 기존 URL은 새 주소로 연결했고, 기사에는 JSON-LD 구조화 데이터를 적용했습니다. 공개 콘텐츠를 기준으로 Sitemap과 Robots를 자동 생성했습니다. **기존 검색 유입과 외부 공유 링크의 단절을 막고, 페이지 추가 시 검색 노출 설정의 누락 위험을 줄였습니다.**

Nginx에는 Gzip, 정적 자산 캐시, HTML No-cache 정책을 구분해 적용했습니다. **적용 후 초기 콘텐츠 노출 시간은 67% 단축됐고 HTML·JavaScript·CSS 전송량은 62.6% 감소했습니다.**

![다국어 URL, Meta Tag, Canonical URL, Redirect, JSON-LD 연결 관계](/images/anai-project-portfolio/main-multilingual-seo-structure.svg)

_Routing, Canonical, Redirect, 구조화 데이터, 크롤링 파일이 공개 콘텐츠 모델을 함께 사용합니다._

![초기 콘텐츠 노출 시간과 HTML·JavaScript·CSS 전송량의 정규화 전후 비교](/images/anai-project-portfolio/main-delivery-performance-comparison.svg)

_글에는 감소율만 있고 원시 시간·용량 값이 없어 적용 전 기준을 100으로 두었습니다._

#### CMS 장애 격리와 뉴스 구조 개선

**AS-IS**

사이트를 빌드할 때 CMS 조회가 실패하면 뉴스와 관계없는 브랜드 페이지도 배포되지 않았습니다. 서비스 실행 중 일부 기사 조회가 실패하면 콘텐츠 제공 경로가 사라졌습니다. 화면마다 데이터 요청과 응답 변환을 따로 구현해 같은 코드가 반복되고 변경 범위가 넓었습니다.

**TO-BE**

CMS 조회와 SEO Build Pipeline을 분리하고, Strapi 조회가 실패하면 최근 조회 데이터와 서버 Fallback 데이터를 순서대로 사용하는 계층을 구성했습니다. **그 결과 CMS가 연결되지 않아도 기본 사이트 빌드가 완료됐고, 일부 데이터 조회 실패 시에도 콘텐츠 제공 경로를 유지했습니다.**

뉴스 조회, 응답 변환, 캐시, SEO 데이터 생성을 공통 흐름으로 통합하고 기능 단위로 프로젝트 구조를 정리했습니다. **관련 코드는 65% 줄었고, 신규 기능을 추가할 때 수정해야 하는 범위도 축소했습니다.**

![CMS 장애 시 Build Pipeline 격리와 Strapi 데이터 Fallback 순서](/images/anai-project-portfolio/main-cms-fallback-flow.svg)

_브랜드 페이지는 독립적으로 Build하고, 뉴스는 Strapi, 최근 데이터, Server Fallback 순으로 조회합니다._

#### AWS 이미지 배포 자동화

**AS-IS**

개발자가 직접 실행 이미지를 만들고 AWS에 전송해 개발·운영 환경 차이와 수동 단계 누락이 배포 오류로 이어질 수 있었습니다. 운영과 개발 이미지의 구분이 명확하지 않으면 잘못된 환경의 이미지가 배포될 위험도 있었습니다. PR과 배포 상태도 수동으로 공유했습니다.

**TO-BE**

Next.js Standalone과 Docker로 설치, 빌드, 실행 환경을 고정했습니다. 운영·개발 브랜치에 코드가 반영되면 GitHub Actions가 환경별 이미지를 Build하고 Amazon Elastic Container Registry(AWS ECR)에 Push하도록 자동화했습니다. **운영과 개발 이미지는 서로 덮어쓰지 않도록 분리해 관리했습니다.**

PR과 배포 결과는 자동으로 알렸습니다. **이를 통해 이미지 Build·Push의 반복 작업과 환경 선택 실수 위험을 줄이고, 코드 리뷰와 배포 상태를 별도로 전달하던 작업을 줄였습니다.**

![Next.js Standalone, Docker, GitHub Actions, AWS ECR 배포 및 알림 흐름](/images/anai-project-portfolio/main-aws-deployment-flow.svg)

_Next.js Standalone으로 Runtime을 고정하고, 운영·개발 Image는 Amazon ECR에서 분리합니다._
