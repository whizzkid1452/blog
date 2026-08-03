---
title: 'DAG(Directed Acyclic Graph)란? 의존 관계에서 실행 순서 구하기'
description: 'DAG의 방향성과 비순환 조건, 위상 정렬과 Cycle 탐지 원리를 살펴보고 DAW Audio Routing에 적용한 이유를 설명합니다.'
date: '2026-08-03'
tags: ['algorithm', 'graph', 'typescript', 'daw', 'audio']
draft: false
visibility: public
---

DAW 엔진의 Audio Routing을 구현하면서 DAG를 공부하게 되었다.

처음에는 Track을 배열 순서대로 처리하면 된다고 생각하기 쉽다. 하지만 Bus와 Send가 추가되면 Signal이 여러 경로로 나뉘고 다시 합쳐진다.

```text
Vocal ──> Vocal Bus ──> Master
   └────> Reverb ─────┘
Guitar ─────────────────┘
```

이 구조에서는 등록 순서보다 의존 관계가 중요하다. Vocal Bus는 Vocal의 출력을 받은 후 처리해야 한다. 반면 Vocal과 Guitar는 서로 의존하지 않기 때문에 어느 쪽을 먼저 처리해도 된다.

이 관계를 코드로 표현하는 과정에서 DAG가 단순한 Graph 자료구조가 아니라 **의존 관계로부터 실행 순서를 계산하는 방법**이라는 점을 알게 되었다.

## [sort1] 1. Directed는 간선에 방향이 있다는 뜻이다

DAG는 Directed Acyclic Graph의 약자다. 한국어로는 방향 비순환 그래프 또는 유향 비순환 그래프라고 한다.

먼저 Directed Graph의 간선은 시작 정점과 도착 정점을 가진다.

```text
A → B
```

이 간선은 A에서 B로 이동할 수 있다는 의미다. 반대로 B에서 A로 이동할 수 있다는 뜻은 아니다.

작업 관계에서는 다음과 같이 해석할 수 있다.

```text
데이터 수집 → 데이터 분석
```

데이터를 분석하려면 데이터 수집이 먼저 끝나야 한다.

Audio Routing에서는 간선이 Signal 방향을 나타낸다.

```text
Track → Bus → Master
```

Track의 출력이 Bus의 입력이 되고, Bus의 출력이 Master의 입력이 된다. 이 경우 Signal 방향은 처리 순서를 결정하는 선행 조건이 된다.

## [sort1] 2. Acyclic은 방향 Cycle이 없다는 뜻이다

방향 Cycle은 간선의 방향을 따라 이동한 뒤 출발한 정점으로 돌아오는 경로다.

```text
A → B → C → A
```

위 Graph에서는 A에서 출발해 다시 A로 돌아올 수 있다. 따라서 DAG가 아니다.

반면 다음 Graph에는 방향 Cycle이 없다.

```text
A → B → D
└→ C ─┘
```

A에서 B나 C로 이동할 수 있지만 다시 A로 돌아오는 경로는 없다. 따라서 DAG다. [DAG 기본 개념](https://jackpot53.tistory.com/84)

DAW에서는 다음과 같은 연결이 방향 Cycle을 만들 수 있다.

```text
Track → Bus → Master → Track
```

Track을 처리하려면 Master의 출력이 필요하고, Master를 처리하려면 다시 Track의 출력이 필요하다. 이런 Feedback 경로는 일반적인 DAG 실행 순서로 처리할 수 없다.

일부 Audio System은 Delay를 포함한 의도적인 Feedback을 지원한다. 하지만 이 경우에는 순환 Graph를 처리할 별도 실행 규칙이 필요하다. DAG가 모든 Audio Routing을 표현할 수 있는 것은 아니다.

## [sort1] 3. DAG와 Tree는 같은 구조가 아니다

Tree도 Cycle이 없는 Graph지만 모든 DAG가 Tree인 것은 아니다.

Tree에서는 Root가 아닌 각 정점이 하나의 부모만 가진다. DAG에서는 하나의 정점이 여러 선행 정점을 가질 수 있다.

```text
A ─┐
   ├→ C
B ─┘
```

C는 A와 B에 모두 의존한다.

Audio Routing에서도 Master는 여러 Track과 Bus의 출력을 함께 받는다. 하나의 Node에 여러 입력이 연결될 수 있기 때문에 Tree보다 DAG가 관계를 표현하기 적합했다.

DAG는 시작점이 하나일 필요도 없다.

```text
Vocal ──> Vocal Bus ─┐
Guitar ──────────────┼→ Master
Drum ───> Drum Bus ──┘
```

Vocal, Guitar, Drum처럼 입력이 없는 여러 시작 Node가 존재할 수 있다.

## [sort1] 4. DAG는 실행이 아니라 의존 관계를 정의한다

DAG에서 정점은 작업을 나타내고, 간선은 작업의 선행 관계를 나타낼 수 있다.

```text
요구사항 분석 → 구현 → 테스트 → 배포
       └──────→ 문서 작성 ──────┘
```

테스트와 문서 작성 사이에는 직접적인 의존 관계가 없다. 따라서 두 작업은 구현이 끝난 뒤 독립적으로 진행할 수 있다.

Airflow도 DAG로 Task의 의존 관계를 정의한다. DAG 자체가 Task를 실행하는 것은 아니다. 실제 실행, 재시도, 상태 관리는 Scheduler가 담당한다. [Airflow DAG 설명](https://soobindeveloper8.tistory.com/1088)

내 프로젝트에서도 DAG는 Audio Buffer를 직접 처리하지 않는다. `ProcessingGraph`는 Node와 의존 관계를 관리하고, 실제 처리 계층에서 사용할 수 있는 실행 순서를 계산한다.

> “DAG는 실행기가 아니라, 실행기가 지켜야 할 의존 관계를 표현한다.”

## [sort1] 5. 위상 정렬은 의존성을 지키는 순서를 만든다

위상 정렬(Topological Sort)은 모든 간선 방향을 지키면서 DAG의 정점을 일렬로 배치하는 방법이다.

```text
A → C
B → C
C → D
```

가능한 위상 순서 중 하나는 다음과 같다.

```text
A → B → C → D
```

다음 순서도 유효하다.

```text
B → A → C → D
```

A와 B 사이에는 의존 관계가 없기 때문에 순서를 바꿀 수 있다. 하나의 DAG가 여러 위상 순서를 가질 수 있는 이유다.

중요한 조건은 모든 간선 `u → v`에서 `u`가 `v`보다 먼저 나오는 것이다. 방향 Graph에 위상 순서가 존재하기 위한 필요충분조건은 해당 Graph가 DAG라는 것이다.

Audio Routing에 적용하면 다음 조건으로 바뀐다.

> “Signal을 보내는 Node는 Signal을 받는 Node보다 먼저 처리되어야 한다.”

따라서 Vocal과 Guitar의 처리 순서는 바뀔 수 있지만 Vocal Bus와 Master의 순서는 바뀔 수 없다.

## [sort1] 6. Kahn 알고리즘은 진입 차수가 0인 Node부터 처리한다

프로젝트에서는 처리 순서를 계산하기 위해 Kahn 알고리즘을 사용했다. A. B. Kahn이 1962년 발표한 위상 정렬 방법이다. [Kahn의 원 논문](https://doi.org/10.1145/368996.369025)

Kahn 알고리즘은 진입 차수(In-degree)를 이용한다. 진입 차수는 해당 정점으로 들어오는 간선의 수다.

1. 모든 정점의 진입 차수를 계산한다.
2. 진입 차수가 0인 정점을 Queue에 넣는다.
3. Queue에서 정점을 꺼내 결과에 추가한다.
4. 해당 정점에서 나가는 간선을 제거한다.
5. 진입 차수가 0이 된 정점을 Queue에 추가한다.
6. 처리할 정점이 없을 때까지 반복한다.

다음은 Kahn 알고리즘의 최소 구현이다.

```ts
type DirectedGraph = Map<string, string[]>;

function topologicalSort(graph: DirectedGraph): string[] {
  const nodes = new Set<string>();

  for (const [source, targets] of graph) {
    nodes.add(source);

    for (const target of targets) {
      nodes.add(target);
    }
  }

  const inDegree = new Map([...nodes].map(node => [node, 0]));

  for (const targets of graph.values()) {
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  const readyNodes = [...nodes].filter(node => inDegree.get(node) === 0);
  const sortedNodes: string[] = [];

  while (readyNodes.length > 0) {
    const currentNode = readyNodes.shift();

    if (currentNode === undefined) {
      break;
    }

    sortedNodes.push(currentNode);

    for (const target of graph.get(currentNode) ?? []) {
      const nextInDegree = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, nextInDegree);

      if (nextInDegree === 0) {
        readyNodes.push(target);
      }
    }
  }

  if (sortedNodes.length !== nodes.size) {
    throw new Error('Graph에 방향 Cycle이 있습니다.');
  }

  return sortedNodes;
}
```

인접 리스트와 효율적인 Queue를 사용하면 Kahn 알고리즘의 시간 복잡도는 `O(V + E)`다. `V`는 정점 수이고 `E`는 간선 수다.

프로젝트의 `ProcessingGraph`도 각 Node의 의존성 수를 계산한 뒤 의존성이 없는 Node부터 결과에 추가한다. 가능한 순서가 여러 개일 때는 ID를 정렬해 같은 Graph가 같은 결과를 반환하도록 구성했다.

## [sort1] 7. Cycle 탐지와 위상 정렬은 같은 조건을 확인한다

Kahn 알고리즘이 끝났는데 처리한 정점 수가 전체 정점 수보다 작다면 Graph에 방향 Cycle이 존재한다.

Cycle에 포함된 Node는 진입 차수가 0이 되지 않는다. 따라서 Queue에 들어갈 수 없다.

DFS(Depth-First Search, 깊이 우선 탐색)를 이용하면 현재 탐색 중인 경로에서 Cycle을 찾을 수 있다. DFS에서는 방문 상태를 보통 다음 세 가지로 나눈다.

- 방문 전
- 현재 탐색 경로에서 방문 중
- 탐색 완료

현재 탐색 경로에서 방문 중인 정점을 다시 만나면 방향 Cycle이 존재한다.

프로젝트에서는 Iterative DFS와 세 가지 방문 상태를 이용해 Cycle을 검사했다. 재귀 호출 대신 명시적인 Stack을 사용해 Graph 깊이가 JavaScript Call Stack의 깊이에 직접 의존하지 않게 했다.

## [sort1] 8. 같은 위상 단계는 병렬 실행 후보가 된다

위상 정렬을 단계별로 나누면 서로 의존하지 않는 Node를 찾을 수 있다.

```text
Level 0: Vocal, Guitar, Drum
Level 1: Vocal Bus, Drum Bus, Reverb
Level 2: Master
```

같은 Level의 Node는 Graph 의존성만 보면 서로의 결과를 기다릴 필요가 없다. 따라서 병렬 실행 후보로 분류할 수 있다.

프로젝트의 `getParallelGroups()`도 이런 Group을 계산한다. 다만 현재 구현이 보장하는 것은 **구조적으로 동시에 처리할 수 있는 후보를 찾는 것**이다. 실제 DSP 연산이 병렬로 실행된다는 뜻은 아니다.

병렬 실행에는 다음 조건도 필요하다.

- Processor가 같은 Mutable Buffer를 동시에 수정하지 않아야 한다.
- Plugin의 Thread Safety가 보장돼야 한다.
- Group 실행 결과를 합치는 순서가 정의돼야 한다.
- Audio Callback의 Deadline을 지켜야 한다.

DAG 분석과 실제 병렬 실행은 서로 다른 문제다.

## [sort1] 9. DAG는 순서보다 의존성을 관리하는 도구였다

DAG는 작업 Scheduling, Data Pipeline, Build System, Package 의존성, Spreadsheet 수식, Git Commit 관계 등에 사용된다. 내 프로젝트에서는 Audio Signal의 처리 관계를 표현하는 데 사용했다.

고정된 실행 순서는 Routing이 바뀔 때마다 다시 작성해야 한다. 반면 의존 관계를 Graph로 관리하면 동일한 알고리즘으로 새로운 실행 순서를 계산할 수 있다.

프로젝트 적용 과정과 아직 남은 Buffer·Latency 계약은 [[Part 6.] Audio Processor 실행 순서를 DAG로 모델링한 이유](/posts/daw-engine-processing-dag)에서 더 자세히 다룬다.

> “복잡한 실행 순서를 직접 관리하고 있다면, 실제로 관리해야 할 대상은 순서가 아니라 의존 관계일 수 있다.”

## 참고

- [방향 비순환 그래프(DAG, Directed Acyclic Graph)](https://jackpot53.tistory.com/84)
- [Airflow DAG란?](https://soobindeveloper8.tistory.com/1088)
- [A. B. Kahn, Topological sorting of large networks](https://doi.org/10.1145/368996.369025)
