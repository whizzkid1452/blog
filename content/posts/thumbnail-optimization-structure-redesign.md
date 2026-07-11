---
title: '[썸네일 생성 최적화 시도 2]썸네일 생성 구조 재설계하기'
description: '타임라인 썸네일 생성을 poster, visible tile, backfill로 나누어 초기 표시와 성능을 개선한 설계를 정리합니다.'
date: '2026-06-06'
publishedAt: '2026-06-06T00:53:42+09:00'
tags: ['performance', 'thumbnail', 'web-worker', 'timeline']
draft: false
---

## 1. 들어가며

비디오 편집 도구에서 타임라인 썸네일은 작은 기능처럼 보이지만, 실제로는 사용자 경험과 성능에 직접 영향을 준다. 사용자는 타임라인 region 안의 이미지를 보고 장면의 흐름을 파악한다. 반대로 썸네일이 늦게 뜨거나 빈 영역이 오래 보이면 업로드가 끝났는지, 영상이 제대로 로드됐는지 판단하기 어렵다.

처음에는 영상 길이를 기준으로 일정 개수의 썸네일을 미리 생성하는 방식이 자연스러워 보였다. 예를 들어 짧은 영상에는 최소 20장, 긴 영상에는 최대 60장을 만드는 식이다. 하지만 타임라인이 실제로 그리는 것은 전체 영상이 아니라 현재 화면에 보이는 영역이다. 이 차이를 놓치면 첫 화면에 필요하지 않은 프레임을 먼저 만들 수 있다.

이번 설계의 핵심은 썸네일 생성을 하나의 작업으로 보지 않고, 목적에 따라 세 가지로 나누는 것이다.

- 초기 표시용 poster
- 현재 viewport에 보이는 tile 썸네일
- idle 시간에 실행하는 backfill

## 2. 용어 정리

이 설계에서 용어를 명확히 구분해야 한다.

| 용어      | 의미                                                                                          |
| --------- | --------------------------------------------------------------------------------------------- |
| poster    | 영상 대표 이미지 1장이다. 특정 timestamp에 정확히 대응하는 썸네일이 아니라 fallback 이미지다. |
| thumbnail | 특정 source timestamp에 대응하는 비디오 프레임 이미지다.                                      |
| viewport  | 사용자가 현재 화면에서 보고 있는 타임라인 영역이다.                                           |
| tile      | 타임라인 region 안에서 썸네일 하나가 그려지는 칸이다.                                         |
| backfill  | 사용자가 지금 보지 않는 구간의 썸네일을 낮은 우선순위로 미리 채우는 작업이다.                 |

가장 중요한 구분은 poster와 thumbnail이다. poster는 "아직 실제 썸네일이 없을 때 보여주는 대표 이미지"이고, thumbnail은 "특정 시간의 프레임"이다. 둘을 같은 캐시에 넣으면 누락 프레임 판단이 부정확해진다.

## 3. 기존 방식의 한계

기존 방식은 영상 길이를 기준으로 baseline 썸네일을 먼저 만들었다. 대략 5초당 1장 수준으로 계산하고, 너무 적거나 많지 않도록 최소값과 최대값을 두는 방식이다.

이 방식은 구현이 단순하다. 하지만 타임라인 UI와 완전히 맞지는 않는다. 타임라인은 전체 영상의 균등 분포 프레임을 바로 보여주는 것이 아니라, 현재 viewport 안의 tile을 그린다. 즉 사용자가 보는 첫 화면에 필요한 timestamp와, duration 기반 baseline timestamp가 다를 수 있다.

특히 긴 영상에서는 문제가 더 커진다. 1시간 영상에 대해 초당 1장씩 썸네일을 만들면 3,600장이 된다. 이는 디코딩 비용, 메모리 사용량, IndexedDB 저장량을 모두 증가시킨다. 반대로 상한을 60장으로 제한하면 전체 비용은 줄지만, 첫 viewport에 필요한 tile이 충분히 채워진다는 보장은 없다.

따라서 질문은 "전체 영상에서 몇 장을 만들 것인가"가 아니라 "사용자가 지금 보는 영역을 어떻게 먼저 채울 것인가"에 가까웠다.

## 4. 새 전략의 기준

새 전략은 작업을 두 종류로 나눈다.

```text
사용자가 지금 보는 것:
  적게 만든다
  빠르게 만든다
  가능하면 정확하게 만든다

사용자가 나중에 볼 수도 있는 것:
  천천히 만든다
  제한적으로 만든다
  근사값을 허용한다
```

이 기준으로 보면 초기 생성과 backfill을 같은 방식으로 처리하면 안 된다. 현재 viewport의 썸네일은 즉시성이 중요하다. 반면 화면 밖 썸네일은 사용자가 볼 수도 있고 안 볼 수도 있다. 따라서 낮은 우선순위로 처리해도 된다.

## 5. poster를 먼저 생성하는 이유

업로드 직후에는 poster 1장을 먼저 만든다. 이 poster는 Source 패널, Preview fallback, Timeline region fallback에 공통으로 사용할 수 있다.

이 선택의 근거는 단순하다. 사용자는 업로드 직후 빈 화면보다 대표 이미지가 보이는 상태를 더 안정적으로 받아들인다. 여러 timestamp 썸네일을 만들기 전에 poster 1장을 먼저 보여주면 초기 표시 지연을 줄일 수 있다.

다만 poster를 thumbnail처럼 다루면 안 된다. poster를 0초 썸네일처럼 thumbnailCache에 넣으면 시스템은 "0초 근처 프레임이 이미 있다"고 판단할 수 있다. 하지만 poster는 fallback이지 정확한 0초 프레임이라는 보장이 없다.

그래서 poster는 posterCache, 실제 timestamp 썸네일은 thumbnailCache에 둔다.

## 6. viewport 기준 생성이 더 적합한 이유

초기 썸네일은 영상 길이가 아니라 현재 viewport 기준으로 만든다.

타임라인 region은 tile 단위로 렌더링된다. 그러면 초기 생성도 현재 viewport 안의 tile 중심 timestamp를 기준으로 하는 편이 자연스럽다. 예를 들어 현재 화면에 tile이 8개 보이면 8개를 먼저 만들고, 좌우로 약간의 preload를 붙일 수 있다.

```text
초기 생성 대상:
  현재 viewport의 visible tile
  + 왼쪽 preload 일부
  + 오른쪽 preload 일부
```

이 방식은 전체 영상 기준 baseline보다 낭비가 적다. 첫 화면에 필요하지 않은 구간을 먼저 디코딩하지 않기 때문이다.

## 7. visible tile은 메인 스레드 seek가 더 낫다

현재 viewport에 보이는 tile은 보통 몇 장 되지 않는다. 이 작업은 생성되는 대로 바로 region에 반영되어야 한다. 그래서 Web Worker보다 hidden video element를 이용한 메인 스레드 seek/capture가 더 적합하다고 판단했다.

흐름은 다음과 같다.

```text
video.currentTime = targetTime
seek 완료 대기
canvas 또는 createImageBitmap으로 프레임 캡처
thumbnailCache에 저장
canvas redraw
```

Web Worker 는 메인 스레드를 막지 않는 장점이 있다. 하지만 현재 Web Worker 경로는 파일 전체를 fetch하고, mp4box로 demux한 뒤, VideoDecoder로 프레임을 만든다. 소수의 visible tile을 빠르게 교체하는 용도에는 초기 비용이 클 수 있다.

물론 메인 스레드 seek에도 주의점은 있다. 하나의 video element는 여러 seek를 동시에 처리할 수 없다. source별로 순차 queue를 두고, 최신 viewport 요청만 유지해야 한다. scroll이나 zoom 중 이전 요청이 늦게 끝나면 stale 결과로 보고 무시해야 한다.

## 8. Web Worker는 idle backfill에 사용한다

Web Worker는 backfill에 더 적합하다. backfill은 사용자가 지금 보는 영역이 아니라, 나중에 볼 가능성이 있는 구간을 미리 채우는 작업이다. 즉시성이 낮기 때문에 Web Worker의 초기 비용을 감수할 수 있다.

다만 backfill도 무제한이면 안 된다. 긴 영상에서 화면 밖 모든 구간을 미리 채우려 하면 결국 기존 문제로 돌아간다.

예시 정책은 다음과 같다.

```ts
const idleIntervalSec = 10;
const maxIdleFramesPerVideo = 120;
const maxFramesPerIdleBatch = 4;
const maxIdleWorkMs = 100;
```

여기서 중요한 것은 하한보다 상한이다. backfill은 필수 작업이 아니라 보조 작업이다. 반드시 몇 장 이상 만들어야 하는 작업이 아니다. 반대로 너무 많이 만들지 않도록 제한하는 것은 필요하다.

## 9. nearest-keyframe 방식의 의미

현재 Web Worker 방식은 요청한 timestamp의 정확한 프레임을 항상 만들지는 않는다. 요청 시각에 가장 가까운 keyframe을 선택한다. 비디오는 모든 프레임이 독립적으로 저장되지 않는다.

| 프레임 종류  | 의미                                             |
| ------------ | ------------------------------------------------ |
| keyframe     | 독립적으로 디코딩 가능한 프레임                  |
| non-keyframe | 주변 프레임 정보를 참조해야 디코딩 가능한 프레임 |

예를 들어 요청 시각이 12.3초이고 keyframe이 10초, 15초에만 있다면 Web Worker는 둘 중 가까운 keyframe을 썸네일로 쓸 수 있다. 따라서 이 결과는 12.3초의 정확한 화면이 아닐 수 있다.

이 방식은 backfill에는 허용 가능하다. backfill의 목적은 화면 밖 구간을 대략 채워두는 것이기 때문이다. 하지만 현재 viewport에 보이는 tile에는 정확도가 더 중요할 수 있다. 그래서 visible tile은 메인 스레드 seek/capture로 처리하는 편이 더 합리적이다.

## 10. 요청 관리에서 필요한 것

메인 스레드를 쓰든 Web Worker를 쓰든 요청 관리는 필요하다.

필수 조건은 다음과 같다.

- 이미 캐시에 있는 timestamp는 다시 생성하지 않는다.
- scroll/zoom 중에는 최신 viewport 요청을 우선한다.
- 파일 교체, undo, 프로젝트 전환 시 이전 결과를 무시한다.
- visible 요청은 idle backfill보다 항상 우선한다.
- source별 작업 순서를 제어한다.
- stale 결과가 새 파일의 캐시에 들어가지 않게 한다.

Web Worker를 사용한다고 해서 이런 문제가 사라지지는 않는다. Web Worker는 seek event 충돌을 줄일 수 있지만, 결과가 늦게 도착하는 문제는 여전히 있다. 따라서 abort와 stale 체크는 계속 필요하다.

## 11. 최종 구조

최종적으로 목표 구조는 다음과 같다.

```text
업로드 직후:
  poster 1장 생성
  Source, Preview, Timeline fallback에 표시

현재 viewport:
  visible tile timestamp 계산
  누락 tile만 main-thread seek queue로 생성
  생성되는 즉시 poster를 실제 썸네일로 교체

스크롤과 줌:
  새 viewport timestamp 계산
  캐시에 없는 tile만 추가 생성
  이전 viewport 요청은 stale 처리

idle 시간:
  Web Worker로 화면 밖 timestamp를 제한적으로 backfill
  visible 요청이 들어오면 backfill 중단 또는 지연

캐시:
  posterCache = fallback 대표 이미지
  thumbnailCache = timestamp 기반 실제 프레임
  IndexedDB = 안정적인 file id 기준 영속 저장
```

구조를 그림으로 표현하면 다음과 같다.

## 12. 마치며

이번 설계에서 가장 중요한 변화는 썸네일 생성을 "많이 미리 만들어두는 작업"으로 보지 않은 것이다. 대신 사용자가 보는 화면과 보지 않는 화면을 분리했다.

현재 화면에 필요한 썸네일은 적게, 빠르게, 가능하면 정확하게 만든다. 화면 밖 썸네일은 Web Worker를 이용해 천천히, 제한적으로, 근사값을 허용하면서 채운다. poster는 이 둘과 별개의 fallback으로 둔다.

이렇게 나누면 초기 표시 안정성과 리소스 사용량 사이의 균형을 잡을 수 있다. 아직 실제 구현에서는 queue 정책, stale 체크, poster image 로딩 캐시, IndexedDB key 정책을 세밀하게 맞춰야 한다. 하지만 설계 기준은 명확해졌다.

> 지금 보는 것은 우선 처리하고, 나중에 볼 수도 있는 것은 보조 작업으로 처리한다.

타임라인 썸네일 생성 전략은 이 기준 위에서 정리할 수 있었다.

이전 글: [썸네일 생성 최적화 시도1] Web Worker 를 이용한 썸네일 생성 최적화 [https://insight74278.tistory.com/42](https://insight74278.tistory.com/42)

다음 글: [썸네일 생성 최적화 시도3] Worker를 다시 의심하고 검증하기 [https://insight74278.tistory.com/51](https://insight74278.tistory.com/51)
