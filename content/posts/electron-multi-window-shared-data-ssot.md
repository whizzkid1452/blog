---
title: 'Electron에서는 공유 데이터를 어디에 둬야 할까?'
description: '멀티 윈도우에서 오래된 Renderer 상태가 최신 작업을 덮어쓴 원인과 Main Process를 공유 데이터의 SSOT로 선택한 과정을 정리합니다.'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00+09:00'
tags: ['electron', 'state-management', 'zustand', 'ssot', 'autosave']
draft: false
---

# Electron에서는 공유 데이터를 어디에 둬야 할까?

## 자동 저장이 최신 스크립트를 지워 버린 날, SSOT를 다시 설계했다

`#electron` `#state-management` `#zustand` `#ssot`

## 목차

1. 개요
2. 수정한 스크립트 유실
3. 수정 전 내용 저장
4. 여러 데이터 기준점
5. 공유 데이터 기능
6. 프로젝트 자동 저장
7. SRT Script Panel
8. Editor
9. Admin
10. 화면과 자동 저장 규칙
11. Editor와 Studio 접근 제한
12. SRT Panel 창 분리
13. 로컬 PC 자동 저장
14. Renderer Process 분리
15. Store 인스턴스 분리
16. Renderer Store 직접 동기화
17. Local Project File 기준
18. Main Process를 SSOT로 선택
19. SSOT와 복사본
20. ProjectSession 구조
21. Plain Object
22. Class
23. Vanilla Zustand
24. 공유 데이터 생명주기
25. 프로젝트 정보
26. 실시간 편집 정보
27. ProjectSession Class
28. Vanilla Zustand Store
29. Renderer 요청과 Main 확정
30. Snapshot 기반 자동 저장
31. Renderer Store 역할
32. 늦게 열린 화면의 Snapshot 검증
33. MessagePort 이벤트 분리
34. AS IS
35. TO BE
36. 회고
37. 이미지 출처

## 개요

자동 저장은 사용자의 작업을 지키려고 만든 기능이었다.

하지만 그 기능이 최신 작업을 누구보다 성실하게 지우고 있었다.

![힘든 상황을 이겨내기 위해 스스로를 가스라이팅하라는 위키하우 패러디 밈](/images/electron-multi-window-shared-data-ssot/self-gaslighting-hardship-meme.jpg)

_자동 저장 버그를 마주한 나: 더 강해지기 위한 과정이라고 생각하기로 했다._

Electron으로 SRT 스크립트와 음성을 함께 편집할 수 있는 멀티미디어 에디터를 개발했다. 애플리케이션에는 Editor와 Admin 페이지가 있었고, SRT Script Panel은 별도 창으로 분리할 수 있었다. 실무진은 Editor와 SRT Panel을 동시에 열어 둔 채 스크립트를 실시간으로 수정했다.

![동일 프로젝트를 편집하는 Editor와 분리된 SRT Script Panel](/images/electron-multi-window-shared-data-ssot/editor-srt-panel-browserwindows.png)

_실제 개발 빌드의 두 BrowserWindow 렌더러 화면을 데모 데이터로 캡처해 나란히 배치했다._

프로젝트에는 자동 저장도 적용되어 있었다. 사용자가 저장 버튼을 누르지 않아도 변경 내용을 로컬 PC에 계속 기록해 주는, 평소라면 아주 든든한 기능이었다.

그러던 어느 날 실무진에게서 제보가 들어왔다.

> “스크립트를 수정하고 점심을 먹고 왔는데, 수정한 내용이 사라져 있어요.”

수정 직후에는 분명 멀쩡했다. SRT Panel에도 최신 문장이 표시됐고, 실무진도 변경 내용을 확인한 뒤 자리를 비웠다. 그런데 프로젝트를 다시 확인하니 스크립트가 수정 전 내용으로 돌아가 있었다.

<p style="width: 100%; max-width: 480px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/unexpected-reaction-meme.jpg" alt="별로 놀랄 일도 아닌 일에 어라고 말하지 말라는 개발자 밈" /></p>

_로그를 열기 전까지는 아무도 “어?”라고 하지 않기로 했다._

단순히 저장 요청이 누락됐다면 마지막으로 저장된 값이 남아 있어야 한다. 하지만 이번에는 **이미 수정한 내용이 과거 데이터로 되돌아가고 있었다.**

로그를 따라가 보니 자동 저장은 멈춘 적이 없었다. 다른 화면에 남아 있던 수정 전 데이터가 자동 저장되면서, 사용자가 방금 수정한 최신 내용을 덮어쓰고 있었다.

```text
SRT Panel에서 스크립트 수정
        ↓
SRT Panel에는 최신 값이 표시됨
        ↓
다른 화면에는 수정 전 값이 남아 있음
        ↓
수정 전 값을 기준으로 자동 저장 실행
        ↓
로컬 프로젝트 파일이 이전 내용으로 덮어써짐
        ↓
프로젝트를 다시 불러오며 화면도 이전 상태로 돌아감
```

![오래된 Renderer Snapshot이 최신 스크립트를 덮어쓰는 순서](/images/electron-multi-window-shared-data-ssot/stale-snapshot-overwrite-sequence.png)

_기존 텍스트 흐름을 순서도로 함께 표현했다._

자동 저장은 사용자의 작업을 보호하기 위해 만든 기능이었다.

하지만 여러 화면이 서로 다른 데이터를 ‘최신’이라고 주장하는 구조에서는, 자동 저장이 보호 장치가 아니라 데이터 삭제 버튼처럼 동작할 수 있었다.

이번 글에서는 이 문제를 추적하면서 Electron 멀티 윈도우 환경의 공유 데이터 소유권을 다시 정하고, 단일 진실 공급원인 SSOT를 설계한 과정을 소개한다.

---

## 문제 1. 점심을 먹고 돌아오면 수정한 스크립트가 사라졌다

문제가 발생한 기능은 SRT Script Panel이었다.

SRT Panel에서는 음성 합성과 편집에 사용할 자막 Row를 실시간으로 수정할 수 있었다. Panel은 별도의 창으로 분리할 수 있었으며, Editor나 Admin 페이지와 동시에 열어 둘 수 있었다.

문제가 발생하는 과정은 다음과 같았다.

```text
1. SRT Panel에서 스크립트를 수정한다.

2. Panel 화면에서 변경된 내용을 확인한다.

3. 다른 작업을 하거나 잠시 자리를 비운다.

4. 자동 저장이 실행된다.

5. 프로젝트 데이터를 다시 불러온다.

6. 수정한 스크립트가 이전 내용으로 돌아간다.
```

오류가 즉시 드러나지 않는다는 점이 특히 위험했다.

사용자는 SRT Panel에서 변경한 내용이 그대로 표시되고 있었기 때문에 작업이 정상적으로 저장되고 있다고 생각할 수 있었다. 하지만 백그라운드에서는 다른 화면이 가지고 있던 수정 전 데이터가 프로젝트 파일에 저장되고 있었다.

이후 탭을 이동하거나 프로젝트 데이터를 다시 불러오는 순간, 파일에 저장된 이전 값이 화면에 반영됐다.

실무진 입장에서는 분명히 작업을 완료하고 자리를 비웠는데, 돌아와 보니 수정한 내용이 사라진 상황이었다.

이 문제는 단순한 화면 갱신 오류가 아니었다.

**사용자가 작성한 실제 작업 결과가 이전 데이터로 덮어써지는 데이터 유실 문제였다.**

---

## 문제 2. 저장되지 않은 것이 아니라 수정 전 내용이 저장되고 있었다

처음 보이는 증상만 보면 자동 저장 기능의 문제처럼 느껴질 수 있다.

하지만 저장되지 않은 것과 이전 내용으로 돌아가는 것은 다른 문제다.

저장 요청이 누락됐다면 사용자가 수정한 화면의 값은 최소한 현재 Renderer 안에는 남아 있어야 한다. 그런데 이 문제에서는 프로젝트 데이터를 다시 불러온 뒤 화면의 값까지 수정 전 상태로 되돌아갔다.

즉, 누군가 이전 내용을 다시 저장하고 있었다.

당시 같은 프로젝트 데이터를 사용하는 기능은 크게 네 가지였다.

| 기능               | 사용하는 데이터             |
| ------------------ | --------------------------- |
| 프로젝트 자동 저장 | 현재 프로젝트 전체 데이터   |
| SRT Script Panel   | 실시간으로 변경되는 SRT Row |
| Editor             | SRT와 연결된 편집 데이터    |
| Admin              | 현재 프로젝트와 SRT 데이터  |

각 화면은 자신이 사용하는 Store에 프로젝트 데이터의 복사본을 가지고 있었다.

```text
SRT Panel Renderer
└─ Project Store A

Editor Renderer
└─ Project Store B

Admin Renderer
└─ Project Store C

Local Project File
└─ Project Snapshot D
```

SRT Panel에서 스크립트를 수정하면 `Store A`에는 최신 값이 반영됐다.

하지만 Editor와 Admin이 바라보는 `Store B`, `Store C`에는 수정 전 값이 남아 있을 수 있었다.

```text
SRT Panel Store
└─ “수정한 스크립트”

Editor Store
└─ “수정 전 스크립트”

Admin Store
└─ “수정 전 스크립트”
```

이 상태에서 Editor나 Admin의 데이터를 기준으로 자동 저장이 실행되면 로컬 프로젝트 파일에는 이전 내용이 기록됐다.

```text
사용자가 수정한 값
└─ “안녕하세요. 수정된 스크립트입니다.”

다른 Renderer에 남아 있던 값
└─ “안녕하세요.”

자동 저장된 프로젝트 파일
└─ “안녕하세요.”
```

자동 저장 코드는 전달받은 값을 정상적으로 파일에 기록하고 있었다.

잘못된 것은 저장 동작이 아니라 **저장에 전달된 데이터**, 다시 말해 input이었다.

<p style="width: 100%; max-width: 480px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/literal-instruction-meme.jpg" alt="지시를 문자 그대로 해석해 우유를 여섯 개 사 온 상황을 보여주는 밈" /></p>

_자동 저장: “저는 전달받은 값을 정확히 저장했는데요?”_

자동 저장 입장에서는 억울할 만했다. 30분 전 Snapshot이든 방금 수정한 Snapshot이든, 전달받은 값을 묻지도 따지지도 않고 파일에 기록했을 뿐이다.

자동 저장은 실패하지 않았다.

**문제는 너무 성실했다는 것이다.**

이때부터 디버깅의 초점은 파일 I/O가 아니라, **누가 어떤 Snapshot을 저장 요청에 넘겼는가**로 바뀌었다.

---

## 문제 3. 같은 데이터에 기준점이 여러 개였다

처음에는 화면 사이의 동기화 코드가 한두 군데 누락된 문제처럼 보였다.

SRT Panel을 수정할 때 Editor Store도 함께 갱신하고, Editor를 수정할 때 Admin Store도 갱신하면 해결할 수 있을 것 같았다.

```text
SRT Panel이 바뀌면 Editor를 갱신한다.
Editor가 바뀌면 Admin을 갱신한다.
Admin이 바뀌면 SRT Panel을 갱신한다.
```

하지만 화면끼리 서로의 Store를 직접 맞추기 시작하면 어떤 화면이 원본이고 어떤 화면이 복사본인지 구분하기 어려워진다.

```text
SRT Panel ─────→ Editor
     │             │
     ↓             ↓
   Admin ←────── Studio
```

<p style="width: 100%; max-width: 480px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/closing-tag-war-meme.jpg" alt="종료 태그로 전쟁을 멈춰 달라고 요구하는 개발자 밈" /></p>

_Renderer 간 Store 전쟁을 멈춰 주세요._

SRT Panel은 자신이 최신이라고 생각했고, Editor도 자신이 최신이라고 생각했다. Admin 역시 물러설 생각이 없었다. 자동 저장은 그중 먼저 도착한 Snapshot을 믿었다.

화면이나 창이 하나 추가될 때마다 새로운 동기화 전선도 생겼다. 어느 한 방향의 업데이트가 누락되면 Store들은 곧바로 서로 다른 과거를 기억하기 시작했다.

더 큰 문제는 여러 화면에서 변경이 연속으로 발생할 때였다.

```text
SRT Panel 변경
    ↓
Editor 동기화

Editor 변경
    ↓
Admin 동기화

Admin의 이전 값 저장
    ↓
프로젝트 파일 덮어쓰기
```

화면 간 복사 순서와 저장 순서에 따라 최신 값이 달라질 수 있었다.

당시 구조의 핵심 문제는 다음과 같았다.

> 같은 데이터를 여러 Store가 독립적으로 소유하고 있었지만, 어느 값이 최신인지 결정하는 기준이 없었다.

따라서 해결해야 할 질문도 자동 저장의 주기나 횟수가 아니었다.

> 자동 저장은 어느 위치의 데이터를 믿어야 하는가?

그리고 더 근본적으로는 다음 질문에 답해야 했다.

> 여러 창이 같은 데이터를 사용할 때, 누가 그 데이터의 최종 결정권을 가져야 하는가?

---

## 조건 1. 어떤 기능이 같은 데이터를 공유했는가

공유 데이터의 위치를 결정하기 전에 어떤 기능이 실제로 같은 데이터를 사용하는지 정리했다.

### 프로젝트 자동 저장

현재 프로젝트 정보를 사용자의 로컬 PC에 저장한다.

### SRT Script Panel

SRT Row를 실시간으로 수정한다. 별도의 창으로 분리할 수 있기 때문에 다른 페이지와 동시에 열릴 수 있다.

### Editor

SRT 데이터와 연결된 편집 정보를 사용한다. SRT Panel에서 데이터가 변경되면 현재 열려 있는 Editor에도 반영돼야 한다.

### Admin

현재 프로젝트와 SRT 데이터를 조회하거나 수정한다. Admin으로 이동했을 때도 최신 데이터가 표시돼야 한다.

이 기능들은 화면의 형태와 역할은 달랐지만, 결국 같은 프로젝트 데이터의 일부를 사용하고 있었다.

---

## 조건 2. 화면과 자동 저장에는 어떤 규칙이 있었는가

다음으로 화면 접근과 데이터 반영 규칙을 정리했다.

### Editor와 Studio는 동시에 접근할 수 없다

Editor와 Studio 페이지는 동시에 사용할 수 없다는 규칙이 있었다.

```text
Editor + Studio
불가능
```

이 규칙은 두 화면에서 동일한 데이터를 동시에 편집하는 충돌을 어느 정도 줄여줬다.

하지만 모든 동기화 문제를 없애주지는 않았다.

### SRT Panel은 별도의 창으로 분리할 수 있다

SRT Script Panel은 독립된 창으로 분리할 수 있었다.

따라서 다음 조합은 가능했다.

```text
Editor + SRT Panel
가능

Admin + SRT Panel
가능
```

SRT Panel에서 변경한 내용은 현재 열려 있는 Editor 또는 Admin에 반영돼야 했다.

반대로 Editor에서 발생한 관련 변경도 SRT Panel이 열려 있다면 전달돼야 했다.

### 변경된 내용은 로컬 PC에 자동 저장해야 한다

프로젝트에서 변경된 내용은 사용자의 로컬 PC에 계속 저장돼야 했다.

정리하면 공유 데이터에는 다음 조건이 있었다.

```text
여러 창이 함께 사용한다.
        +
실시간으로 변경된다.
        +
열려 있는 관련 화면에 반영돼야 한다.
        +
로컬 프로젝트 파일에 저장돼야 한다.
        +
특정 창을 닫아도 유지돼야 한다.
```

이 조건을 정리하고 나니, 문제는 Store 여러 개를 서로 연결하는 것보다 **공유 데이터의 소유권을 결정하는 일**에 가까웠다.

---

## 원인 1. Electron의 창은 서로 다른 Renderer Process에서 동작한다

일반적인 React 애플리케이션에서는 Zustand나 Redux Store 하나를 만들고 여러 컴포넌트가 같은 값을 구독할 수 있다.

그래서 처음에는 Electron에서도 같은 Store 모듈을 import하면 동일한 값을 공유할 것처럼 생각했다.

```ts
import { useProjectStore } from './projectStore';
```

하지만 Electron 멀티 윈도우 환경에서는 전역의 범위가 달랐다.

Electron 애플리케이션에는 Main Process와 Renderer Process가 있다. Main Process는 애플리케이션의 진입점이며 창과 애플리케이션 생명주기를 관리한다. 각 `BrowserWindow`는 별도의 Renderer Process에서 웹 페이지를 실행한다. 따라서 여러 창은 서로 독립된 JavaScript 실행 환경과 메모리를 가진다. ([Electron](https://electronjs.org/docs/latest/tutorial/process-model 'Process Model'))

```text
Main Process
 ├─ Editor Window
 │    └─ Renderer Process A
 │         └─ Project Store A
 │
 └─ SRT Panel Window
      └─ Renderer Process B
           └─ Project Store B
```

이 글의 구조도에서는 데이터 흐름을 단순하게 보여주기 위해 Main과 Renderer 사이의 Preload Script를 생략한다.

실제 구현에서는 Renderer에 Electron API 전체를 노출하기보다, Preload Script와 `contextBridge`를 통해 필요한 기능만 제한적으로 제공하는 편이 안전하다. Electron 공식 문서도 이러한 IPC 노출 방식을 안내하고 있다. ([Electron](https://electronjs.org/docs/latest/tutorial/ipc 'Inter-Process Communication'))

---

## 원인 2. 같은 Store 코드는 같은 Store 인스턴스가 아니었다

Editor와 SRT Panel에서 같은 Store 모듈을 import했다는 것은 **같은 코드로 Store를 생성했다**는 뜻이다.

동일한 Store 인스턴스를 공유한다는 뜻은 아니다.

```text
Renderer A의 projectStore
≠
Renderer B의 projectStore
```

React 웹 애플리케이션에서 말하는 전역 Store는 하나의 JavaScript 실행 환경 안에서 전역이다.

Electron에서는 창마다 Renderer Process와 메모리가 분리되기 때문에, Renderer 내부의 전역 Store가 애플리케이션 전체의 전역 Store가 되지는 않는다.

이 구조를 이해하고 나니 데이터가 어긋난 과정도 명확해졌다.

```text
창이 분리된다.
    ↓
Renderer Process가 분리된다.
    ↓
Store 인스턴스도 분리된다.
    ↓
각 Store가 서로 다른 Snapshot을 가진다.
    ↓
수정 전 Snapshot이 자동 저장될 수 있다.
```

![여러 Renderer Store와 Electron 프로세스 경계를 보여주는 AS-IS 구조](/images/electron-multi-window-shared-data-ssot/as-is-renderer-stores.png)

_기존 구조의 Store 인스턴스와 프로세스 경계를 시각화했다._

Renderer 간 데이터를 전달하려면 Main Process를 메시지 중계자로 사용하거나, Main에서 MessagePort를 생성해 각 Renderer에 전달해야 한다. 일반적인 `ipcMain`과 `ipcRenderer`만으로 Renderer끼리 직접 메시지를 보내는 방식은 제공되지 않는다. ([Electron](https://electronjs.org/docs/latest/tutorial/ipc 'Inter-Process Communication'))

---

## 시도 1. Renderer Store끼리 직접 동기화한다

첫 번째로 생각한 방법은 각 Renderer Store를 서로 동기화하는 것이었다.

SRT Panel에서 스크립트가 변경되면 Editor와 Admin의 Store에도 같은 값을 전달한다.

```text
SRT Panel Store 변경
        ↓
Editor Store 갱신
        ↓
Admin Store 갱신
```

현재 열려 있는 화면이 적고 동기화 방향이 단순하다면 구현할 수 있는 방식이다.

하지만 이 구조에서는 각 화면이 서로를 알아야 했다.

- SRT Panel은 Editor와 Admin을 알아야 한다.
- Editor는 SRT Panel과 Admin을 알아야 한다.
- 새로운 화면이 생기면 기존 동기화 코드도 수정해야 한다.
- 하나의 이벤트 전달이 누락되면 다시 데이터가 어긋난다.
- 동시에 여러 변경이 발생하면 어떤 값이 최신인지 판단하기 어렵다.

<p style="width: 100%; max-width: 480px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/temporary-fix-meme.jpg" alt="코드의 오류를 손바닥으로 막고 있는 임시방편을 표현한 밈" /></p>

_동기화가 누락될 때마다 IPC 하나씩 추가하던 시절._

당장은 조용해졌다. 문제는 손을 뗄 수 없다는 것이었다.

새로운 창이 생기거나 이벤트가 한 번 누락될 때마다 또 다른 IPC가 필요했다. 결국 Store 사이의 복사 경로만 늘어날 뿐, 다음 질문에는 답하지 못했다.

> 여러 Store의 값이 서로 다르면 무엇을 기준으로 맞춰야 하는가?

동기화는 필요했다. 하지만 동기화보다 먼저 **기준점**이 필요했다.

---

## 시도 2. Local Project File을 기준으로 삼는다

두 번째로 프로젝트 파일을 SSOT로 사용하는 방법을 검토했다.

모든 변경을 파일에 저장하고, 각 Renderer가 파일을 다시 읽는다면 하나의 파일을 기준으로 값을 맞출 수 있을 것처럼 보였다.

```text
Renderer에서 변경
       ↓
로컬 파일에 저장
       ↓
다른 Renderer가 파일 다시 읽기
       ↓
화면 갱신
```

하지만 로컬 파일은 영속적인 데이터 보관에는 적합해도, 실행 중인 실시간 상태를 조정하는 주체로 사용하기에는 문제가 있었다.

- 연속된 입력마다 파일 읽기와 쓰기가 발생한다.
- 여러 저장 요청의 실행 순서를 보장해야 한다.
- 파일 쓰기가 끝나기 전에 다시 읽으면 이전 데이터가 반환될 수 있다.
- 각 Renderer가 파일을 읽는 시점에 따라 서로 다른 값을 볼 수 있다.
- 파일 시스템이 저장소뿐 아니라 상태 동기화 채널 역할까지 맡게 된다.

무엇보다 이번 문제 자체가 수정 전 Snapshot이 파일에 저장되면서 발생했다.

파일을 기준으로 정한다고 해도 다음 질문은 그대로 남는다.

> 어떤 Snapshot을 파일에 기록해야 하는가?

따라서 로컬 파일은 애플리케이션이 종료된 뒤에도 데이터를 유지하기 위한 영속 저장소로 역할을 한정했다.

```text
실행 중인 최신 데이터
└─ 메모리의 ProjectSession

앱 종료 후에도 보존할 데이터
└─ Local Project File
```

---

## 결정 1. Main Process를 SSOT로 둔다

여기까지 오고 나니 질문 자체가 잘못됐다는 것을 알았다.

“누구에게 변경 내용을 더 보내야 하지?”가 아니었다.

> “애초에 누가 원본이지?”

<p style="width: 100%; max-width: 480px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/midnight-bug-solution-meme.jpg" alt="잠든 개발자를 깨워 버그 해결법을 알려 주는 뇌 밈" /></p>

_뇌: “주인님, 자동 저장 버그가 아니라 데이터 소유권 문제인 것 같아요.”_

그 질문으로 Main Process를 다시 살펴봤다.

우리 애플리케이션에서 프로젝트 파일 저장은 이미 Main Process가 담당하고 있었다.

Renderer에서 변경된 프로젝트 데이터를 저장하려면 Main으로 요청을 보내야 했다.

```text
Renderer에서 변경
       ↓
Main Process
       ↓
Local Project File
```

다른 Renderer에 변경 내용을 전달할 때도 Main Process가 각 창에 메시지를 전송할 수 있었다.

그리고 Main Process는 특정 화면의 생명주기에 종속되지 않는다.

```text
Editor 창 종료
    ↓
Editor Renderer 종료

Main Process
    ↓
ProjectSession 유지
```

Editor가 닫히더라도 Main Process에 있는 현재 프로젝트 데이터는 유지할 수 있다. 이후 Admin이나 SRT Panel이 열리면 현재 Snapshot을 다시 전달할 수 있다.

결국 공유 데이터의 주요 흐름이 이미 Main Process를 지나고 있었다.

따라서 실행 중인 공유 데이터의 SSOT를 Main Process에 두기로 했다.

![Main Process의 ProjectDocumentService를 SSOT로 둔 TO-BE 구조](/images/electron-multi-window-shared-data-ssot/to-be-project-document-service.png)

_Main Process를 SSOT로 두는 변경 방향을 실제 구현 명칭으로 표현했다._

다만 이것이 다음을 의미하지는 않는다.

> Electron의 모든 상태를 Main Process에서 관리한다.

Main Process에서 관리할 대상은 다음 조건에 해당하는 데이터로 제한했다.

- 여러 Renderer가 함께 사용한다.
- 로컬 프로젝트 파일에 저장돼야 한다.
- 특정 창이 닫혀도 유지돼야 한다.
- 저장되는 값과 화면에서 보는 최신 값이 일치해야 한다.

Modal, Hover, 검색어처럼 특정 화면에서만 사용하는 상태는 계속 각 Renderer에서 관리한다.

---

## 설계 1. SSOT는 복사본을 하나만 두는 것이 아니다

Main Process를 SSOT로 정했다고 해서 Renderer에 프로젝트 데이터가 존재하면 안 되는 것은 아니다.

Renderer가 화면을 그리려면 결국 렌더링에 사용할 값이 필요하다.

이번 구조에서 SSOT는 다음과 같은 의미로 정의했다.

> 데이터 복사본이 물리적으로 하나뿐이라는 뜻이 아니라, 값이 서로 다를 때 무엇을 기준으로 맞출지 결정하는 주체가 하나라는 뜻이다.

Renderer에는 화면 렌더링을 위한 데이터 복사본이 존재할 수 있다.

다만 Main Process와 Renderer의 값이 다르다면 Main Process의 Snapshot을 기준으로 맞춘다. 프로젝트 데이터 변경도 Main Process에서 최종적으로 확정한다.

| 위치               | 역할                                                |
| ------------------ | --------------------------------------------------- |
| Main Process       | 최신 Snapshot 결정, 변경 규칙 적용, 저장, Broadcast |
| Renderer Store     | 화면을 렌더링하기 위한 로컬 복사본                  |
| Local Project File | 앱 종료 이후에도 데이터를 유지하는 영속 저장소      |

---

## 설계 2. ProjectSession은 Class와 Vanilla Zustand를 조합한다

SSOT의 위치를 정한 뒤에는 다음 질문이 생겼다.

> Main Process 안에서는 현재 프로젝트 Snapshot을 무엇으로 관리해야 할까?

Main Process에는 React 컴포넌트 트리가 없다.

따라서 `useState`나 React Context처럼 React 렌더링을 전제로 하는 도구를 그대로 사용할 수는 없다.

세 가지 방법을 검토했다.

### Plain Object

현재 Snapshot을 보관하는 것만 필요하다면 일반 객체로도 충분하다.

```ts
let currentProject: ProjectSnapshot = initialProjectSnapshot;
```

하지만 이번 구조에는 값 보관 외에도 여러 책임이 있었다.

- 현재 Snapshot 조회
- SRT Row 변경
- 프로젝트 정보 수정
- 변경 감지
- 로컬 파일 저장 요청
- Renderer Broadcast
- 외부 코드의 직접 변경 방지

Plain Object만으로도 구현할 수 있지만, 관련 코드가 여러 위치로 흩어질 가능성이 있었다.

### Class

Class를 사용하면 외부에 허용된 변경 메서드만 공개할 수 있다.

```ts
projectSession.updateScriptRows(rows);
projectSession.updateProjectInfo(info);
```

프로젝트 변경 규칙, 파일 저장, Renderer Broadcast를 하나의 객체 안에 캡슐화할 수 있다는 장점도 있었다.

### Vanilla Zustand

Zustand의 `createStore`는 React 없이 사용할 수 있는 Vanilla Store를 만든다.

생성된 Store는 `getState`, `setState`, `subscribe` 등의 API를 제공하므로 현재 Snapshot을 보관하고 변경을 감지하는 용도로 사용할 수 있다. ([Zustand](https://zustand.docs.pmnd.rs/reference/apis/create-store 'createStore - Zustand'))

Class와 Vanilla Zustand는 서로 다른 문제를 해결하고 있었다.

| 도구            | 담당 역할                                   |
| --------------- | ------------------------------------------- |
| Class           | 프로젝트 변경 규칙, 저장, Broadcast, 캡슐화 |
| Vanilla Zustand | Snapshot 보관, 조회, 변경, 구독             |

따라서 둘 중 하나를 고르는 대신 `ProjectSession` Class 안에 Vanilla Zustand Store를 두기로 했다.

---

## 설계 3. ProjectSession이 공유 데이터의 생명주기를 관리한다

Main Process에서 관리해야 할 데이터는 크게 두 종류였다.

### 자주 변경되지 않는 프로젝트 정보

- 프로젝트 이름
- 프로젝트 경로
- 설정 정보
- 메타데이터

### 실시간으로 변경되는 편집 정보

- SRT Script Row
- 스크립트 내용
- 편집 결과
- 로컬 파일에 저장돼야 하는 사용자 변경 내용

이 데이터들을 하나의 `ProjectSnapshot`으로 관리했다.

```ts
type ProjectSnapshot = {
  revision: number;
  projectInfo: ProjectInfo;
  scriptRows: SrtRow[];
};
```

`ProjectSession`은 현재 Snapshot을 보관하고, 외부에는 허용된 변경 메서드만 제공한다.

```ts
import { createStore } from 'zustand/vanilla';

class ProjectSession {
  private readonly store = createStore<ProjectSnapshot>()(() => initialProjectSnapshot);

  private saveQueue: Promise<void> = Promise.resolve();

  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = this.store.subscribe((snapshot, previousSnapshot) => {
      if (snapshot.revision === previousSnapshot.revision) {
        return;
      }

      const nextSnapshot = structuredClone(snapshot);

      this.enqueueSave(nextSnapshot);
      this.broadcastProjectChanged(nextSnapshot);
    });
  }

  getSnapshot(): ProjectSnapshot {
    return structuredClone(this.store.getState());
  }

  updateScriptRows(scriptRows: SrtRow[]): void {
    this.store.setState(state => ({
      scriptRows,
      revision: state.revision + 1,
    }));
  }

  updateProjectInfo(projectInfo: ProjectInfo): void {
    this.store.setState(state => ({
      projectInfo,
      revision: state.revision + 1,
    }));
  }

  dispose(): void {
    this.unsubscribe();
  }

  private enqueueSave(snapshot: ProjectSnapshot): void {
    this.saveQueue = this.saveQueue
      .then(() => this.saveProject(snapshot))
      .catch(error => {
        console.error('Failed to save project', error);
      });
  }

  private async saveProject(snapshot: ProjectSnapshot): Promise<void> {
    // 사용자의 로컬 프로젝트 파일에 저장한다.
  }

  private broadcastProjectChanged(snapshot: ProjectSnapshot): void {
    // 현재 열려 있는 관련 Renderer에
    // 최신 Snapshot 또는 Patch를 전달한다.
  }
}
```

이 구조에서 역할은 다음처럼 나뉜다.

### ProjectSession Class

- 프로젝트 데이터의 변경 규칙 관리
- 외부에서 호출할 수 있는 API 제한
- 로컬 파일 저장 요청
- 저장 순서 관리
- Renderer Broadcast
- 외부 직접 변경 방지

### Vanilla Zustand Store

- 현재 프로젝트 Snapshot 보관
- `getState`를 통한 Snapshot 조회
- `setState`를 통한 Snapshot 변경
- `subscribe`를 통한 변경 감지

Zustand를 애플리케이션 전체 아키텍처로 사용한 것은 아니다.

**Main Process 안에서 현재 Snapshot을 보관하는 구현 도구로 제한해서 사용했다.**

---

## 구현 1. Renderer는 변경을 요청하고 Main이 확정한다

기존에는 각 Renderer가 자신의 Store를 수정하고, 해당 Store의 값이 자동 저장에 사용될 수 있었다.

새로운 구조에서는 Renderer가 프로젝트 데이터를 직접 확정하지 않는다.

Renderer는 사용자의 변경 의도를 Main Process에 전달한다.

```text
SRT Renderer
    ↓ updateScriptRows
Main Process
    ↓
ProjectSession Snapshot 변경
    ↓
로컬 파일 저장 요청
    ↓
관련 Renderer에 Broadcast
```

SRT Panel에서는 다음과 같이 변경을 요청한다.

```ts
window.project.updateScriptRows(nextRows);
```

Main Process는 요청을 받아 `ProjectSession`을 변경한다.

```ts
ipcMain.on('project:update-script-rows', (_event, rows: SrtRow[]) => {
  projectSession.updateScriptRows(rows);
});
```

Snapshot이 변경되면 Vanilla Zustand의 `subscribe`가 실행된다.

```text
Renderer의 변경 요청
        ↓
ProjectSession의 변경 메서드
        ↓
Vanilla Zustand setState
        ↓
subscribe
   ┌────┴─────┐
   ↓          ↓
파일 저장   Renderer Broadcast
```

![Renderer 변경 요청부터 Main 저장과 Broadcast까지의 순서](/images/electron-multi-window-shared-data-ssot/project-document-update-save-broadcast.png)

_변경 요청, 자동 저장, Renderer Broadcast의 순서를 시각화했다._

이제 자동 저장은 여러 Renderer 중 하나의 Store를 임의로 선택하지 않는다.

항상 Main Process의 `ProjectSession`이 가진 최신 Snapshot을 기준으로 실행된다.

---

## 구현 2. 자동 저장은 ProjectSession의 Snapshot만 사용한다

자동 저장 구조를 변경할 때 가장 중요한 규칙은 단순했다.

> Renderer가 가진 프로젝트 데이터로 파일을 직접 저장하지 않는다.

모든 저장은 `ProjectSession`의 Snapshot을 기준으로 실행한다.

```text
기존

Renderer Store
    ↓
자동 저장


변경 후

Renderer
    ↓ 변경 요청
ProjectSession
    ↓ 최신 Snapshot 확정
자동 저장
```

사용자의 변경은 Main Process의 메모리 Snapshot에 즉시 반영한다.

디스크 쓰기는 비동기로 처리하되, 이전 Snapshot의 저장이 나중에 끝나면서 최신 파일을 다시 덮어쓰지 않도록 순서를 보장한다.

```text
사용자 입력
    ↓
Main Snapshot 즉시 변경
    ↓
저장 Queue에 요청 등록
    ↓
입력 순서대로 비동기 파일 저장
```

변경 빈도가 높다면 짧은 시간 동안 발생한 파일 저장 요청을 병합할 수도 있다.

다만 파일 저장을 지연하더라도 Main Process의 Snapshot까지 늦게 변경해서는 안 된다.

실행 중 최신 값의 기준은 항상 `ProjectSession`이어야 한다.

---

## 구현 3. Renderer Store는 화면 렌더링에만 사용한다

Main Process의 Snapshot이 변경되면 Renderer 화면도 다시 렌더링돼야 한다.

Renderer는 Main에서 변경 이벤트를 받고, 전달받은 값을 React가 구독할 수 있는 상태에 반영한다.

Main에서 받은 데이터는 여러 컴포넌트가 함께 사용하고 있었다. 또한 SRT Row만 바뀌었을 때 프로젝트 이름만 사용하는 컴포넌트까지 같은 범위로 구독할 필요는 없었다.

따라서 Renderer에서는 Main에서 받은 Snapshot 또는 Patch를 Zustand Store에 반영하고, 각 컴포넌트가 자신에게 필요한 Slice만 Selector로 구독하도록 했다.

```ts
window.project.onSnapshotChanged(snapshot => {
  useProjectRendererStore.getState().applySnapshot(snapshot);
});
```

컴포넌트에서는 필요한 데이터만 구독한다.

```ts
const scriptRows = useProjectRendererStore(state => state.scriptRows);
```

```ts
const projectName = useProjectRendererStore(state => state.projectInfo.name);
```

Main Process Store와 Renderer Store의 역할은 다르다.

```text
Main Process Store
└─ 무엇이 최신인지 결정하는 SSOT

Renderer Store
└─ 최신 데이터를 화면에 표시하기 위한 로컬 복사본
```

Renderer Store를 제거한 것이 아니다.

**진실을 결정하는 역할에서 화면을 그리는 역할로 바꾼 것이다.**

프로젝트 규모가 커져 전체 Snapshot을 매번 전달하는 비용이 부담된다면, 변경된 영역만 Patch로 전달하는 방식도 고려할 수 있다.

---

## 보완 1. 늦게 열린 화면은 Snapshot을 다시 검증한다

현재 열려 있는 Renderer에는 Main Process가 변경된 Snapshot을 Broadcast하면 된다.

하지만 Admin 탭이 나중에 열리거나 Renderer가 새로 로드됐다면 이전에 발생한 Broadcast를 받을 수 없다.

```text
SRT 데이터 변경
    ↓
Editor와 SRT Panel은 Broadcast 수신
    ↓
이후 Admin 탭 진입
    ↓
Admin은 이전 Broadcast를 받지 못함
```

처음에는 Admin 탭에 진입할 때 로컬 프로젝트 파일을 다시 읽는 방법도 생각할 수 있었다.

하지만 Main Process의 Snapshot은 이미 최신 값으로 변경됐지만, 비동기 파일 저장은 아직 끝나지 않았을 수 있다.

```text
Main Process의 Snapshot
└─ 최신 값

저장 중인 Local Project File
└─ 이전 값
```

이때 로컬 파일을 다시 읽으면 오히려 이전 데이터가 반환될 수 있다.

실행 중인 SSOT를 Main Process로 정했다면 화면을 다시 검증할 때도 Main Process를 기준으로 해야 한다.

따라서 Admin 탭에 진입하거나 새로운 창이 열릴 때 `ProjectSession`의 현재 Snapshot을 다시 요청하도록 했다.

```ts
const snapshot = await window.project.getSnapshot();

useProjectRendererStore.getState().applySnapshot(snapshot);
```

전체 흐름은 다음과 같다.

```text
현재 열려 있는 화면
└─ Main의 Broadcast로 갱신

새로 열린 창 또는 활성화된 탭
└─ Main의 현재 Snapshot 다시 요청
```

비동기 Snapshot 요청과 Broadcast의 도착 순서가 뒤바뀔 수 있다면 `revision` 값을 비교해 이전 Snapshot이 최신 값을 덮어쓰지 못하도록 처리할 수 있다.

```ts
function applySnapshot(incoming: ProjectSnapshot): void {
  const currentRevision = useProjectRendererStore.getState().revision;

  if (incoming.revision < currentRevision) {
    return;
  }

  useProjectRendererStore.setState(incoming);
}
```

---

## 보완 2. 저장하지 않는 이벤트는 MessagePort로 분리한다

프로젝트 데이터 동기화와 비슷해 보이지만 성격이 다른 요구사항도 있었다.

Editor에서 특정 Region을 클릭하면 SRT Panel에서 연결된 Script Row를 Highlight하고 해당 위치까지 스크롤해야 했다.

```text
Editor에서 Region 클릭
        ↓
SRT Panel의 Row Highlight
        ↓
해당 Row 위치로 Scroll
```

이 이벤트도 창 사이에서 전달돼야 한다.

하지만 프로젝트 데이터는 아니다.

Region 선택과 Scroll 위치는 애플리케이션을 다시 실행했을 때 복원할 필요가 없다. 사용자의 편집 결과가 아니라 현재 상호작용을 나타내는 일시적인 UI 이벤트이기 때문이다.

이 값을 `ProjectSession`에 넣으면 다음과 같은 흐름이 발생한다.

```text
Region 클릭
    ↓
Project Snapshot 변경
    ↓
프로젝트 파일 저장
    ↓
모든 Renderer에 Snapshot Broadcast
```

단순히 Row를 Highlight하기 위해 프로젝트 저장까지 실행하게 된다.

따라서 데이터를 성격에 따라 세 종류로 분리했다.

| 데이터 종류           | 예시                              | 관리 위치             | 파일 저장 |
| --------------------- | --------------------------------- | --------------------- | --------- |
| 저장되는 공유 데이터  | SRT Row, 프로젝트 정보, 편집 결과 | Main의 ProjectSession | 필요      |
| Renderer 내부 상태    | Modal, Filter, Hover              | 각 Renderer Store     | 불필요    |
| 일시적인 창 간 이벤트 | Highlight, Scroll, Selection      | IPC 또는 MessagePort  | 불필요    |

단발성 이벤트라면 일반 IPC를 사용할 수 있다.

반면 지속적이거나 빈도가 높은 이벤트를 별도의 채널로 분리하고 싶다면 `MessageChannelMain`과 `MessagePortMain`을 사용할 수 있다. Main Process에서 연결된 Port 쌍을 생성한 뒤 각각의 Renderer에 전달하면, 초기 연결 이후 두 Renderer 사이에 지속적인 메시지 채널을 구성할 수 있다. ([Electron](https://electronjs.org/docs/latest/tutorial/message-ports 'MessagePorts in Electron'))

```text
Editor Renderer
      │
      │ Region Selected
      ▼
 MessagePort Channel
      │
      ▼
SRT Panel Renderer
      │
      ├─ Row Highlight
      └─ Scroll
```

Main Process는 채널을 연결하지만, 이 이벤트를 프로젝트 Snapshot에는 저장하지 않는다.

이렇게 저장되는 데이터와 일시적인 UI 이벤트를 분리함으로써 `ProjectSession`이 모든 화면 상호작용을 처리하는 거대한 Event Bus가 되는 것을 피할 수 있었다.

---

## 결과 1. AS IS

기존 구조에는 다음과 같은 문제가 있었다.

```text
각 Renderer
└─ 프로젝트 데이터의 복사본을 독립적으로 관리

자동 저장
└─ 호출된 위치의 Store를 기준으로 실행
```

- 각 Renderer가 프로젝트 데이터의 복사본을 독립적으로 관리했다.
- 창마다 Store 인스턴스가 달랐다.
- 동일한 데이터에 여러 개의 기준점이 존재했다.
- 사용자가 편집한 값과 자동 저장되는 값이 달라질 수 있었다.
- 수정 전 Snapshot이 최신 작업을 덮어쓸 수 있었다.
- 새로 열린 화면은 이전 변경 이벤트를 받을 수 없었다.
- 저장되는 데이터와 일시적인 UI 이벤트가 같은 흐름에 섞여 있었다.
- 자동 저장이 어느 Store의 값을 기준으로 해야 하는지 불명확했다.

---

## 결과 2. TO BE

구조를 변경한 뒤에는 데이터 흐름이 다음과 같이 정리됐다.

```text
Renderer
   ↓ 변경 요청
Main Process의 ProjectSession
   ├─ 최신 Snapshot 확정
   ├─ Local Project File 저장
   └─ 관련 Renderer에 Broadcast
```

- Main Process의 `ProjectSession`이 공유 데이터의 최신 값을 결정한다.
- Renderer는 프로젝트 데이터를 직접 확정하지 않고 Main에 변경을 요청한다.
- 자동 저장은 항상 `ProjectSession`의 Snapshot을 기준으로 실행한다.
- Main이 확정한 Snapshot을 관련 Renderer에 전달한다.
- Renderer Store는 화면 렌더링을 위한 로컬 복사본으로 사용한다.
- 새로운 창이나 탭은 진입 시 Main의 현재 Snapshot을 다시 요청한다.
- 로컬 프로젝트 파일은 영속 저장과 앱 재실행 시 복구에 사용한다.
- Highlight와 Scroll 같은 임시 이벤트는 별도의 채널로 전달한다.
- 저장되는 데이터와 UI 상태의 책임이 분명해졌다.

최종적으로 데이터는 세 가지 흐름으로 나뉘었다.

```text
저장되는 공유 데이터
└─ Main Process의 ProjectSession

화면을 위한 로컬 상태
└─ Renderer Zustand Store

저장되지 않는 임시 이벤트
└─ IPC 또는 MessagePort
```

구조를 바꾸기 전에는 자동 저장이 가장 위험한 기능이었다.

구조를 바꾼 뒤에는 자동 저장이 다시 본업으로 돌아왔다. 사용자의 작업을 지우는 기능이 아니라, 사용자의 작업을 지키는 기능이 됐다.

<p style="width: 100%; max-width: 480px; margin-inline: auto;"><img src="/images/electron-multi-window-shared-data-ssot/hate-love-programming-meme.png" alt="프로그래밍을 싫어하다가 코드가 작동하면 다시 좋아하는 개발자 티셔츠 밈" /></p>

_I hate multi-window state.\
Oh, SSOT works.\
I love architecture._

---

## 회고. 자동 저장보다 먼저 정해야 했던 것

처음에는 자동 저장을 가장 유력한 용의자로 봤다.

하지만 로그를 따라가 보니 자동 저장은 멈추거나 실패한 적이 없었다. 시킨 일을 했을 뿐이었다.

**수정 전 데이터를 기준으로 너무 정상적으로 저장하고 있었다.**

문제는 저장 함수가 아니라, 어떤 데이터가 저장되어야 하는지 결정하는 주체가 없었다는 점이었다.

각 Renderer는 같은 프로젝트 데이터의 복사본을 들고 자신이 최신이라고 주장했다. 그 결과 오래된 Snapshot이 프로젝트 파일에 저장되면서 사용자가 수정한 최신 내용을 덮어썼다.

이 문제를 해결하면서 상태 관리 도구보다 먼저 결정해야 하는 것이 있다는 것을 알게 됐다.

> 어떤 Store를 사용할 것인가보다, 이 데이터의 최종 결정권을 어디에 둘 것인가?

Electron 멀티 윈도우 환경에서는 각 창이 별도의 Renderer Process에서 실행된다.

따라서 한 Renderer 안의 전역 Store를 애플리케이션 전체의 전역 Store처럼 사용할 수 없다.

이번 프로젝트에서는 저장되는 공유 데이터의 기준을 Main Process에 두었다. Renderer Store는 전달받은 데이터를 화면에 표시하고, 저장할 필요가 없는 일시적인 UI 이벤트는 별도의 채널로 전달했다.

핵심은 모든 State를 한곳에 모으는 것이 아니었다.

저장되는 데이터, 화면을 위한 상태, 순간적인 UI 이벤트를 분리하고 **공유 데이터의 최신 값을 확정하는 주체를 하나로 정하는 것**이었다.

데이터의 소유권을 먼저 정하고 나니 Zustand, IPC, MessagePort가 각각 어디에서 어떤 역할을 해야 하는지도 자연스럽게 정리됐다.

새로운 상태 관리 라이브러리가 문제를 해결한 것은 아니었다. Zustand도 IPC도 이전부터 있었다. 달라진 것은 단 하나였다.

> 여러 값이 서로 다를 때, 누구의 값을 믿을지를 먼저 정했다.

Electron에서 공유 데이터를 설계할 때는 “어떤 Store를 사용할까?”보다 “자동 저장은 누구의 데이터를 믿어야 할까?”를 먼저 물어야 했다.

---

## 이미지 출처

본문의 밈 이미지는 [hello_world.cpp의 개발자 유머 짤 모음](https://raekki.tistory.com/entry/%EA%B0%9C%EB%B0%9C%EC%9E%90-%EC%9C%A0%EB%A8%B8-%EC%A7%A4-%EB%B0%88-%EC%BB%B4%EA%B3%B5-%EC%A7%A4-gif-%EC%9D%B4%EB%AF%B8%EC%A7%80 '개발자 유머 짤, 밈 / 컴공 짤 / gif, 이미지')에서 가져왔다. 해당 페이지는 여러 이미지를 모아 둔 형태이므로, 공개 게시 전 각 이미지의 원출처와 재사용 조건을 확인하는 것을 권장한다.

`힘든 상황을 이겨내는 방법` 이미지는 [루리웹 게시물](https://m.ruliweb.com/etcs/board/300781/read/60873745 '힘든 상황을 이겨내는 방법')에서 가져왔다. 이 게시물 역시 재게시물로 보이므로, 공개 게시 전 원출처와 재사용 조건을 별도로 확인해야 한다.
