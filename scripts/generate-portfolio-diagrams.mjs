import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rough from 'roughjs/bundled/rough.cjs.js';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const OUTPUT_DIRECTORY = path.join(PROJECT_ROOT, 'public', 'images', 'anai-project-portfolio');
const SOURCE_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'sources');
const EXCALIFONT_PATH = path.join(SCRIPT_DIRECTORY, 'assets', 'excalifont-latin.woff2');
const XIAOLAI_KOREAN_PATH = path.join(SCRIPT_DIRECTORY, 'assets', 'xiaolai-korean-portfolio.woff2');

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675;
const CANVAS_COLOR = '#fffdf7';
const INK = '#1f2937';
const MUTED = '#64748b';
const PURPLE = '#7048e8';
const BLUE = '#228be6';
const TEAL = '#0ca678';
const GREEN = '#2f9e44';
const ORANGE = '#f08c00';
const RED = '#e03131';
const TEXT_LINE_HEIGHT = 1.25;
const ARTIST_ROUGHNESS = 1;
const roughGenerator = rough.generator();

const FILLS = {
  purple: '#eee8ff',
  blue: '#e7f5ff',
  teal: '#e6fcf5',
  green: '#ebfbee',
  yellow: '#fff9db',
  orange: '#fff4e6',
  red: '#fff0f0',
  gray: '#f1f3f5',
  white: '#ffffff',
};

let elementSequence = 0;

const escapeXml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const hashSeed = value => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
};

const estimateTextWidth = (text, fontSize) => {
  const longestLineWidth = String(text)
    .split('\n')
    .reduce(
      (longest, line) =>
        Math.max(
          longest,
          [...line].reduce((width, character) => width + (character.charCodeAt(0) > 127 ? 1 : 0.56), 0)
        ),
      0
    );
  return Math.max(fontSize, longestLineWidth * fontSize);
};

const measureTextHeight = (text, fontSize) => String(text).split('\n').length * fontSize * TEXT_LINE_HEIGHT;

const createBaseElement = ({ type, x, y, width, height, stroke = INK, fill = 'transparent' }) => {
  elementSequence += 1;
  const id = `portfolio-${elementSequence}`;
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: fill,
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: ARTIST_ROUGHNESS,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: `a${elementSequence.toString(36)}`,
    roundness: type === 'rectangle' ? { type: 3 } : null,
    seed: hashSeed(id),
    version: 1,
    versionNonce: hashSeed(`${id}-version`),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  };
};

const createRectangleElement = primitive => ({
  ...createBaseElement({
    type: 'rectangle',
    x: primitive.x,
    y: primitive.y,
    width: primitive.width,
    height: primitive.height,
    stroke: primitive.stroke,
    fill: primitive.fill,
  }),
});

const createEllipseElement = primitive => ({
  ...createBaseElement({
    type: 'ellipse',
    x: primitive.x,
    y: primitive.y,
    width: primitive.width,
    height: primitive.height,
    stroke: primitive.stroke,
    fill: primitive.fill,
  }),
  roundness: null,
});

const createDiamondElement = primitive => ({
  ...createBaseElement({
    type: 'diamond',
    x: primitive.x,
    y: primitive.y,
    width: primitive.width,
    height: primitive.height,
    stroke: primitive.stroke,
    fill: primitive.fill,
  }),
  roundness: { type: 2 },
});

const createTextElement = primitive => {
  const width = primitive.width ?? estimateTextWidth(primitive.text, primitive.fontSize);
  const height = measureTextHeight(primitive.text, primitive.fontSize);
  return {
    ...createBaseElement({
      type: 'text',
      x: primitive.x,
      y: primitive.y,
      width,
      height,
      stroke: primitive.color,
      fill: 'transparent',
    }),
    fontSize: primitive.fontSize,
    fontFamily: 5,
    text: primitive.text,
    textAlign: primitive.align,
    verticalAlign: 'top',
    containerId: null,
    originalText: primitive.text,
    autoResize: true,
    lineHeight: TEXT_LINE_HEIGHT,
  };
};

const createArrowElement = primitive => {
  const [origin, ...remainingPoints] = primitive.points;
  const relativePoints = [[0, 0], ...remainingPoints.map(([x, y]) => [x - origin[0], y - origin[1]])];
  const xs = relativePoints.map(([x]) => x);
  const ys = relativePoints.map(([, y]) => y);
  return {
    ...createBaseElement({
      type: 'arrow',
      x: origin[0],
      y: origin[1],
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      stroke: primitive.color,
      fill: 'transparent',
    }),
    points: relativePoints,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    elbowed: false,
    strokeStyle: primitive.dashed ? 'dashed' : 'solid',
    roundness: { type: 2 },
  };
};

class Diagram {
  constructor({ name, title, subtitle, project }) {
    this.name = name;
    this.title = title;
    this.subtitle = subtitle;
    this.primitives = [];
    this.pill({ x: 965, y: 42, width: 180, height: 34, text: project, fill: FILLS.purple, stroke: PURPLE });
  }

  rectangle({ x, y, width, height, fill = FILLS.white, stroke = INK, radius = 18, opacity = 1 }) {
    this.primitives.push({ type: 'rectangle', x, y, width, height, fill, stroke, radius, opacity });
    return this;
  }

  ellipse({ x, y, width, height, fill = FILLS.white, stroke = INK }) {
    this.primitives.push({ type: 'ellipse', x, y, width, height, fill, stroke });
    return this;
  }

  diamond({ x, y, width, height, fill = FILLS.yellow, stroke = ORANGE, text }) {
    this.primitives.push({ type: 'diamond', x, y, width, height, fill, stroke });
    if (text) {
      this.text({ x, y: y + height / 2 - 12, width, text, fontSize: 16, color: INK, align: 'center' });
    }
    return this;
  }

  text({ x, y, text, width, fontSize = 18, color = INK, align = 'left', weight = 400 }) {
    this.primitives.push({ type: 'text', x, y, text, width, fontSize, color, align, weight });
    return this;
  }

  box({ x, y, width, height, title, detail, fill = FILLS.white, stroke = INK, accent, centerContent = false }) {
    this.rectangle({ x, y, width, height, fill, stroke });
    if (accent) {
      this.primitives.push({
        type: 'line',
        points: [
          [x + 18, y + 14],
          [x + width - 18, y + 14],
        ],
        color: accent,
        width: 5,
      });
    }
    const titleFontSize = 19;
    const titleHeight = measureTextHeight(title, titleFontSize);
    const detailFontSize = 14;
    const detailHeight = detail ? measureTextHeight(detail, detailFontSize) : 0;
    const centeredContentY = y + (height - titleHeight - detailHeight - 10) / 2;
    const titleY = detail ? (centerContent ? centeredContentY : y + 27) : y + (height - titleHeight) / 2;
    this.text({
      x: x + 14,
      y: titleY,
      width: width - 28,
      text: title,
      fontSize: titleFontSize,
      align: 'center',
      weight: 700,
    });
    if (detail) {
      this.text({
        x: x + 16,
        y: centerContent ? titleY + titleHeight + 10 : y + 62,
        width: width - 32,
        text: detail,
        fontSize: detailFontSize,
        color: MUTED,
        align: 'center',
      });
    }
    return this;
  }

  pill({ x, y, width, height = 34, text, fill = FILLS.gray, stroke = MUTED, color = INK }) {
    this.rectangle({ x, y, width, height, fill, stroke, radius: 17 });
    this.text({ x, y: y + 7, width, text, fontSize: 15, color, align: 'center', weight: 700 });
    return this;
  }

  arrow({ points, label, color = MUTED, dashed = false, labelX, labelY, labelWidth = 130 }) {
    this.primitives.push({ type: 'arrow', points, color, dashed });
    if (label) {
      const firstPoint = points[0];
      const lastPoint = points.at(-1);
      const middlePoint = [(firstPoint[0] + lastPoint[0]) / 2, (firstPoint[1] + lastPoint[1]) / 2];
      this.text({
        x: labelX ?? middlePoint[0] - labelWidth / 2,
        y: labelY ?? middlePoint[1] - 27,
        width: labelWidth,
        text: label,
        fontSize: 14,
        color,
        align: 'center',
      });
    }
    return this;
  }

  line({ points, color = MUTED, width = 2, dashed = false }) {
    this.primitives.push({ type: 'line', points, color, width, dashed });
    return this;
  }

  note({ x, y, width, text, color = PURPLE }) {
    this.pill({ x, y, width, height: 38, text, fill: FILLS.purple, stroke: color, color });
    return this;
  }

  metric({ x, y, width, label, before, after, ratio, unit, color = BLUE }) {
    this.rectangle({ x, y, width, height: 205, fill: FILLS.white, stroke: '#adb5bd' });
    this.text({ x: x + 16, y: y + 20, width: width - 32, text: label, fontSize: 18, align: 'center', weight: 700 });
    const chartX = x + 44;
    const chartY = y + 78;
    const chartWidth = width - 88;
    this.text({ x: chartX, y: chartY - 4, width: 88, text: before, fontSize: 17, color: MUTED, align: 'left' });
    this.rectangle({
      x: chartX,
      y: chartY + 27,
      width: chartWidth,
      height: 18,
      fill: FILLS.gray,
      stroke: '#ced4da',
      radius: 8,
    });
    this.text({ x: chartX, y: chartY + 63, width: 88, text: after, fontSize: 19, color, align: 'left', weight: 700 });
    this.rectangle({
      x: chartX,
      y: chartY + 95,
      width: Math.max(4, chartWidth * ratio),
      height: 18,
      fill: color,
      stroke: color,
      radius: 8,
    });
    this.text({ x: x + width - 92, y: y + 171, width: 68, text: unit, fontSize: 13, color: MUTED, align: 'right' });
    return this;
  }
}

const createEditorStateDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-state-command-flow',
    title: '하나의 프로젝트 상태를 여러 편집 화면에서 사용',
    subtitle: 'Command는 Electron Process 경계를 통과하고, Selector는 각 Renderer의 갱신 범위를 제한합니다.',
    project: 'Editor',
  });
  diagram
    .arrow({
      points: [
        [300, 251],
        [470, 251],
      ],
      label: 'IPC Command',
      color: PURPLE,
      labelY: 218,
    })
    .arrow({
      points: [
        [730, 251],
        [900, 251],
      ],
      label: '확정 Snapshot',
      color: TEAL,
      labelY: 218,
    })
    .arrow({
      points: [
        [600, 365],
        [600, 470],
      ],
      label: 'Command 이력',
      color: ORANGE,
      labelX: 620,
      labelY: 404,
    })
    .arrow({
      points: [
        [900, 345],
        [790, 505],
        [745, 505],
      ],
      label: 'Export도 같은 상태 사용',
      color: TEAL,
      labelX: 790,
      labelY: 421,
      labelWidth: 210,
    })
    .box({
      x: 55,
      y: 145,
      width: 245,
      height: 210,
      title: 'Renderer 창',
      detail: 'Timeline\nSRT Panel\nPreview',
      fill: FILLS.blue,
      stroke: BLUE,
      accent: BLUE,
    })
    .box({
      x: 470,
      y: 145,
      width: 260,
      height: 220,
      title: 'Main Process',
      detail: 'ProjectSession\n프로젝트 상태 SSOT',
      fill: FILLS.purple,
      stroke: PURPLE,
      accent: PURPLE,
    })
    .box({
      x: 900,
      y: 145,
      width: 245,
      height: 210,
      title: 'Selector 갱신',
      detail: '구독한 상태 조각만\n각 창에 전달',
      fill: FILLS.teal,
      stroke: TEAL,
      accent: TEAL,
    })
    .box({
      x: 470,
      y: 470,
      width: 260,
      height: 130,
      title: 'Command + History',
      detail: '실행 / 실행 취소 / 다시 실행',
      fill: FILLS.orange,
      stroke: ORANGE,
    })
    .box({
      x: 805,
      y: 480,
      width: 250,
      height: 120,
      title: 'Preview + Export',
      detail: '동일한 확정 프로젝트 상태',
      fill: FILLS.green,
      stroke: GREEN,
    });
  return diagram;
};

const createLocalFirstDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-local-first-revision-chain',
    title: 'Local-first 저장과 Cloud Revision 동기화',
    subtitle: '로컬 저장을 먼저 완료하고, 응답의 Session과 Revision이 일치할 때만 Cloud 결과를 반영합니다.',
    project: 'Editor',
  });
  diagram
    .arrow({
      points: [
        [220, 260],
        [350, 260],
      ],
      label: '먼저 저장',
      color: BLUE,
      labelY: 228,
    })
    .arrow({
      points: [
        [590, 260],
        [710, 260],
      ],
      label: 'Sync Queue 등록',
      color: PURPLE,
      labelY: 228,
    })
    .arrow({
      points: [
        [945, 260],
        [1065, 260],
      ],
      label: '반영',
      color: TEAL,
      labelY: 228,
    })
    .box({
      x: 55,
      y: 185,
      width: 165,
      height: 150,
      title: '편집',
      detail: '프로젝트 문서\n+ 미디어',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 350,
      y: 175,
      width: 240,
      height: 170,
      title: 'IndexedDB',
      detail: '로컬 저장 완료\nOffline 편집 지속',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .box({
      x: 710,
      y: 165,
      width: 235,
      height: 190,
      title: '응답 검사',
      detail: '같은 Session ID?\n같은 Revision ID?',
      fill: FILLS.yellow,
      stroke: ORANGE,
    })
    .box({
      x: 1065,
      y: 185,
      width: 95,
      height: 150,
      title: 'Cloud',
      detail: 'Revision',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .text({ x: 55, y: 415, width: 400, text: 'Revision 연결', fontSize: 21, weight: 700 })
    .arrow({
      points: [
        [170, 510],
        [345, 510],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [465, 510],
        [640, 510],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [760, 510],
        [925, 465],
      ],
      color: ORANGE,
      label: '동시 수정 분기',
      labelX: 765,
      labelY: 445,
      labelWidth: 170,
    })
    .ellipse({ x: 80, y: 465, width: 90, height: 90, fill: FILLS.gray, stroke: MUTED })
    .text({ x: 80, y: 493, width: 90, text: '시작', fontSize: 17, align: 'center', weight: 700 })
    .ellipse({ x: 345, y: 465, width: 120, height: 90, fill: FILLS.blue, stroke: BLUE })
    .text({ x: 345, y: 484, width: 120, text: 'R1\nUUID', fontSize: 16, align: 'center', weight: 700 })
    .ellipse({ x: 640, y: 465, width: 120, height: 90, fill: FILLS.teal, stroke: TEAL })
    .text({ x: 640, y: 484, width: 120, text: 'R2\n부모: R1', fontSize: 15, align: 'center', weight: 700 })
    .ellipse({ x: 925, y: 420, width: 150, height: 90, fill: FILLS.orange, stroke: ORANGE })
    .text({ x: 925, y: 440, width: 150, text: 'R2-B\n부모: R1', fontSize: 15, align: 'center', weight: 700 })
    .note({ x: 760, y: 555, width: 370, text: '늦게 도착한 응답은 새 Session을 덮어쓰지 못함' });
  return diagram;
};

const createEditorPerformanceDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-performance-comparison',
    title: 'Editor 상호작용 성능 전후 비교',
    subtitle: 'Thumbnail 지표는 브라우저 작업을 포함하고, React actualDuration은 React 렌더링 시간만 측정합니다.',
    project: 'Editor',
  });
  diagram
    .metric({
      x: 55,
      y: 170,
      width: 330,
      label: '첫 Thumbnail',
      before: '6.26 s',
      after: '2.82 s',
      ratio: 2.82 / 6.26,
      unit: '-55.0%',
      color: BLUE,
    })
    .metric({
      x: 435,
      y: 170,
      width: 330,
      label: 'Main Thread busy',
      before: '66%',
      after: '11%',
      ratio: 11 / 66,
      unit: '-83.3%',
      color: TEAL,
    })
    .metric({
      x: 815,
      y: 170,
      width: 330,
      label: 'React actualDuration',
      before: '2.87 ms',
      after: '1.98 ms',
      ratio: 1.98 / 2.87,
      unit: '-31.0%',
      color: PURPLE,
    })
    .box({
      x: 130,
      y: 450,
      width: 290,
      height: 110,
      title: '화면 구간 우선 Decode',
      detail: 'Worker + WebCodecs',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 455,
      y: 450,
      width: 290,
      height: 110,
      title: 'Main Thread 밖에서 처리',
      detail: 'UI와 Decode 경로 분리',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .box({
      x: 780,
      y: 450,
      width: 290,
      height: 110,
      title: 'Frame 주기에 맞춘 Drag',
      detail: 'Overlay 갱신 후 최종 상태 반영',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .note({ x: 335, y: 595, width: 530, text: '측정 범위가 달라 수치를 서로 직접 비교할 수 없음' });
  return diagram;
};

const createEditorMediaFlowDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-media-processing-flow',
    title: '미디어 편집의 세 처리 경로를 분리',
    subtitle: 'Thumbnail Decode, Drag 피드백, 미디어 가져오기는 서로 다른 처리 방식을 사용합니다.',
    project: 'Editor',
  });
  const rows = [175, 335, 495];
  const colors = [BLUE, PURPLE, ORANGE];
  const fills = [FILLS.blue, FILLS.purple, FILLS.orange];
  const labels = ['Thumbnail', 'Timeline Drag', '미디어 가져오기'];
  labels.forEach((label, index) =>
    diagram.pill({
      x: 55,
      y: rows[index] + 28,
      width: 150,
      text: label,
      fill: fills[index],
      stroke: colors[index],
      color: colors[index],
    })
  );
  diagram
    .arrow({
      points: [
        [305, 220],
        [430, 220],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [650, 220],
        [780, 220],
      ],
      color: BLUE,
    })
    .box({ x: 225, y: 175, width: 160, height: 90, title: '보이는 구간', fill: FILLS.blue, stroke: BLUE })
    .box({
      x: 430,
      y: 165,
      width: 220,
      height: 110,
      title: 'Worker',
      detail: 'WebCodecs Decode',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({ x: 780, y: 175, width: 260, height: 90, title: 'Thumbnail 목록', fill: FILLS.teal, stroke: TEAL })
    .arrow({
      points: [
        [385, 380],
        [495, 380],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [685, 380],
        [805, 380],
      ],
      color: PURPLE,
    })
    .box({ x: 225, y: 335, width: 160, height: 90, title: 'Pointer\nEvent', fill: FILLS.purple, stroke: PURPLE })
    .box({
      x: 495,
      y: 325,
      width: 190,
      height: 110,
      title: '최신 위치',
      detail: '메모리에 보관',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 805,
      y: 325,
      width: 260,
      height: 110,
      title: 'RAF Overlay',
      detail: 'Drag 종료 시 한 번 반영',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .arrow({
      points: [
        [385, 540],
        [505, 540],
      ],
      color: ORANGE,
    })
    .arrow({
      points: [
        [695, 540],
        [805, 540],
      ],
      color: TEAL,
      label: '지원',
      labelY: 508,
    })
    .arrow({
      points: [
        [600, 585],
        [805, 585],
      ],
      color: ORANGE,
      label: 'Fallback',
      labelY: 590,
    })
    .box({ x: 225, y: 495, width: 160, height: 90, title: '미디어 파일', fill: FILLS.orange, stroke: ORANGE })
    .diamond({ x: 505, y: 490, width: 190, height: 100, text: 'WebCodecs?' })
    .box({
      x: 805,
      y: 490,
      width: 260,
      height: 90,
      title: '빠른 가져오기 경로',
      detail: '또는 FFmpeg 호환 경로',
      fill: FILLS.green,
      stroke: GREEN,
    });
  return diagram;
};

const createAudioPerformanceDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-audio-processing-comparison',
    title: 'Bulk 오디오 배치 처리의 측정 결과',
    subtitle: '같은 676개 데이터로 적용 전후를 비교했습니다.',
    project: 'Editor',
  });
  diagram
    .metric({
      x: 45,
      y: 160,
      width: 255,
      label: '처리 시간',
      before: '15.58 s',
      after: '13.08 s',
      ratio: 13.08 / 15.58,
      unit: '-16.1%',
      color: BLUE,
    })
    .metric({
      x: 330,
      y: 160,
      width: 255,
      label: 'Long Task 누적',
      before: '2.24 s',
      after: '0.38 s',
      ratio: 0.38 / 2.24,
      unit: '-82.8%',
      color: TEAL,
    })
    .metric({
      x: 615,
      y: 160,
      width: 255,
      label: '반영 오류',
      before: '78',
      after: '0',
      ratio: 0,
      unit: '0건',
      color: GREEN,
    })
    .metric({
      x: 900,
      y: 160,
      width: 255,
      label: '메모리 Peak',
      before: '2.32 GB',
      after: '2.12 GB',
      ratio: 2.12 / 2.32,
      unit: '-8.6%',
      color: PURPLE,
    })
    .arrow({
      points: [
        [160, 455],
        [1040, 455],
      ],
      color: MUTED,
    })
    .box({ x: 90, y: 425, width: 180, height: 90, title: '676개', fill: FILLS.gray, stroke: MUTED })
    .box({ x: 355, y: 425, width: 210, height: 90, title: 'Bulk IPC', fill: FILLS.blue, stroke: BLUE })
    .box({ x: 655, y: 425, width: 210, height: 90, title: '동시 작업 제한', fill: FILLS.teal, stroke: TEAL })
    .box({ x: 950, y: 425, width: 180, height: 90, title: '반영 완료', fill: FILLS.green, stroke: GREEN })
    .note({ x: 375, y: 570, width: 450, text: 'IPC 호출 수 감소 + 동시 작업 수 제한' });
  return diagram;
};

const createAudioFlowDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-audio-processing-flow',
    title: '개별 처리 경합을 제한된 Bulk 처리로 전환',
    subtitle: 'Bulk 전송, 동시 작업 수 제한, 작업 Queue, Buffer 재사용이 서로 다른 비용을 줄입니다.',
    project: 'Editor',
  });
  const boxes = [
    { x: 55, title: '오디오 676개', detail: '배치 입력', fill: FILLS.gray, stroke: MUTED },
    { x: 280, title: 'Bulk IPC', detail: 'Process 호출 감소', fill: FILLS.blue, stroke: BLUE },
    { x: 505, title: '동시 작업 제한', detail: '실행 중인 작업 수 제한', fill: FILLS.purple, stroke: PURPLE },
    { x: 730, title: '작업 Queue', detail: 'Chunk 사이 양보', fill: FILLS.orange, stroke: ORANGE },
    { x: 955, title: '결과 반영', detail: '안정된 배치', fill: FILLS.green, stroke: GREEN },
  ];
  boxes.forEach(box => diagram.box({ ...box, y: 215, width: 190, height: 150 }));
  [245, 470, 695, 920].forEach((x, index) =>
    diagram.arrow({
      points: [
        [x, 290],
        [x + 35, 290],
      ],
      color: [BLUE, PURPLE, ORANGE, GREEN][index],
    })
  );
  diagram
    .arrow({
      points: [
        [825, 365],
        [825, 485],
        [695, 485],
      ],
      label: '재사용',
      color: TEAL,
      labelX: 735,
      labelY: 450,
    })
    .box({
      x: 505,
      y: 440,
      width: 190,
      height: 100,
      title: '재사용 Buffer',
      detail: '반복 할당 방지',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .note({ x: 325, y: 585, width: 550, text: '전송 비용, 작업 경합, 메모리 할당을 각각 줄임' });
  return diagram;
};

const createAudioRegionPerformanceDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-audio-region-performance-flow',
    title: '676개 오디오 반영에서 1,518개 Region 편집까지',
    subtitle: '오디오 반영은 676개 오디오를, 타임라인 편집은 18개 Track과 1,518개 Region을 기준으로 측정했습니다.',
    project: 'Editor',
  });

  const audioBoxes = [
    {
      x: 55,
      title: '676개 오디오',
      detail: '실제 프로젝트',
      fill: FILLS.gray,
      stroke: MUTED,
    },
    {
      x: 280,
      title: 'Bulk IPC',
      detail: '676회 → 1회',
      fill: FILLS.blue,
      stroke: BLUE,
    },
    {
      x: 505,
      title: '작업 Queue',
      detail: '최대 4개 실행',
      fill: FILLS.purple,
      stroke: PURPLE,
    },
    {
      x: 730,
      title: 'Revision 검사',
      detail: '최신 결과 / 복사 제거',
      fill: FILLS.orange,
      stroke: ORANGE,
    },
    {
      x: 955,
      title: '오디오 반영',
      detail: '안정적으로 완료',
      fill: FILLS.green,
      stroke: GREEN,
    },
  ];

  const regionBoxes = [
    {
      x: 955,
      title: '1,518개 Region',
      detail: '18개 Track',
      fill: FILLS.gray,
      stroke: MUTED,
    },
    {
      x: 730,
      title: '시간 Index',
      detail: '목록 변경 시 생성',
      fill: FILLS.blue,
      stroke: BLUE,
    },
    {
      x: 505,
      title: '이진 조회',
      detail: '화면 후보만 조회',
      fill: FILLS.purple,
      stroke: PURPLE,
    },
    {
      x: 280,
      title: '스크롤 신호',
      detail: 'TrackRow 렌더 분리',
      fill: FILLS.orange,
      stroke: ORANGE,
    },
    {
      x: 55,
      title: 'Canvas 갱신',
      detail: '편집 입력 유지',
      fill: FILLS.green,
      stroke: GREEN,
    },
  ];

  diagram
    .text({ x: 55, y: 100, width: 340, text: '1. 676개 오디오 반영', fontSize: 21, color: BLUE, weight: 700 })
    .text({
      x: 55,
      y: 330,
      width: 380,
      text: '2. 1,518개 Region 편집',
      fontSize: 21,
      color: PURPLE,
      weight: 700,
    });

  audioBoxes.forEach(box => diagram.box({ ...box, y: 150, width: 190, height: 115 }));
  regionBoxes.forEach(box => diagram.box({ ...box, y: 385, width: 190, height: 115 }));

  [245, 470, 695, 920].forEach((x, index) =>
    diagram.arrow({
      points: [
        [x, 207],
        [x + 35, 207],
      ],
      color: [BLUE, PURPLE, ORANGE, GREEN][index],
    })
  );

  [955, 730, 505, 280].forEach((x, index) =>
    diagram.arrow({
      points: [
        [x, 442],
        [x - 35, 442],
      ],
      color: [BLUE, PURPLE, ORANGE, GREEN][index],
    })
  );

  diagram
    .arrow({
      points: [
        [1050, 265],
        [1050, 385],
      ],
      label: 'Region\u00a0\u00a0반영',
      color: TEAL,
      labelX: 970,
      labelY: 310,
      labelWidth: 160,
    })
    .note({
      x: 105,
      y: 565,
      width: 470,
      text: '676개: 처리 16.1% 감소 / Long Task 82.8% 감소',
      color: BLUE,
    })
    .note({
      x: 625,
      y: 565,
      width: 470,
      text: '1,518개: Long Task 73.9% 감소 / 입력 7.9%p 향상',
      color: PURPLE,
    });

  return diagram;
};

const createExportDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-export-stability-flow',
    title: '메모리와 OS 경계를 고려한 Export 안정화',
    subtitle: 'WAV는 큰 연속 할당을 피하고, AAF는 macOS Runtime 포함 여부와 서명을 실제 파일로 검증합니다.',
    project: 'Editor',
  });
  diagram
    .text({ x: 55, y: 150, width: 470, text: '장시간 WAV', fontSize: 22, color: BLUE, weight: 700 })
    .arrow({
      points: [
        [210, 255],
        [345, 255],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [565, 255],
        [700, 255],
      ],
      color: TEAL,
    })
    .box({ x: 55, y: 200, width: 155, height: 110, title: 'Audio\nStream', fill: FILLS.blue, stroke: BLUE })
    .box({
      x: 345,
      y: 190,
      width: 220,
      height: 130,
      title: '분할 Encoder',
      detail: '작은 단위 할당',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 700,
      y: 190,
      width: 230,
      height: 130,
      title: 'BlobParts',
      detail: '하나의 Blob으로 결합',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .note({ x: 955, y: 235, width: 190, text: '대형 ArrayBuffer 없음', color: TEAL })
    .line({
      points: [
        [55, 375],
        [1145, 375],
      ],
      color: '#ced4da',
      dashed: true,
    })
    .text({ x: 55, y: 405, width: 470, text: 'macOS AAF', fontSize: 22, color: PURPLE, weight: 700 })
    .arrow({
      points: [
        [245, 510],
        [360, 510],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [565, 510],
        [680, 510],
      ],
      color: ORANGE,
    })
    .arrow({
      points: [
        [875, 510],
        [980, 510],
      ],
      color: GREEN,
    })
    .box({ x: 55, y: 460, width: 190, height: 100, title: 'Runtime +\nLibrary', fill: FILLS.purple, stroke: PURPLE })
    .box({
      x: 360,
      y: 450,
      width: 205,
      height: 120,
      title: 'Code Signing',
      detail: '서명된 App Bundle',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 680,
      y: 450,
      width: 195,
      height: 120,
      title: 'Smoke Test',
      detail: '실제 AAF 생성',
      fill: FILLS.orange,
      stroke: ORANGE,
    })
    .box({ x: 980, y: 460, width: 165, height: 100, title: '배포', fill: FILLS.green, stroke: GREEN });
  return diagram;
};

const createRecoveryDiagram = () => {
  const diagram = new Diagram({
    name: 'editor-observability-recovery-flow',
    title: '실패한 Editor 탭을 관측·격리·복구',
    subtitle: 'Telemetry는 재현 조건을 좁히고, 탭 단위 Boundary는 화면 장애 범위를 제한합니다.',
    project: 'Editor',
  });
  diagram
    .arrow({
      points: [
        [220, 260],
        [360, 200],
      ],
      color: RED,
      label: 'Context 기록',
      labelX: 220,
      labelY: 190,
    })
    .arrow({
      points: [
        [220, 300],
        [360, 380],
      ],
      color: RED,
      label: '격리',
      labelX: 245,
      labelY: 350,
    })
    .arrow({
      points: [
        [590, 380],
        [730, 380],
      ],
      color: PURPLE,
      label: '다시 시도',
      labelY: 347,
    })
    .arrow({
      points: [
        [945, 380],
        [1070, 300],
      ],
      color: GREEN,
      label: '복구',
      labelX: 930,
      labelY: 315,
    })
    .box({
      x: 55,
      y: 220,
      width: 165,
      height: 120,
      title: '탭 오류',
      detail: '생성·미디어 경로',
      fill: FILLS.red,
      stroke: RED,
    })
    .box({
      x: 360,
      y: 145,
      width: 230,
      height: 120,
      title: 'Sentry Event',
      detail: '위치 + 실행 환경 + 경로',
      fill: FILLS.orange,
      stroke: ORANGE,
    })
    .box({
      x: 360,
      y: 330,
      width: 230,
      height: 120,
      title: 'Error Boundary',
      detail: '탭 단위 격리',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 730,
      y: 330,
      width: 215,
      height: 120,
      title: '두 상태 초기화',
      detail: 'Boundary + Query 오류',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({ x: 1070, y: 235, width: 90, height: 120, title: '탭', detail: '정상', fill: FILLS.green, stroke: GREEN })
    .note({ x: 315, y: 530, width: 570, text: '한 탭을 복구하는 동안 다른 편집 탭은 계속 사용' });
  return diagram;
};

const createGenerationRecoveryDiagram = () => {
  const diagram = new Diagram({
    name: 'kit-generation-recovery-state',
    title: '저장된 생성 작업을 새로고침과 재시도 후에도 복구',
    subtitle: '멱등성 Key는 중복 요청을 같은 작업으로 처리하고, Server 작업 처리 중에만 Polling합니다.',
    project: 'Kit + Tool',
  });
  diagram
    .arrow({
      points: [
        [215, 235],
        [350, 235],
      ],
      color: BLUE,
      label: '저장',
      labelY: 202,
    })
    .arrow({
      points: [
        [590, 235],
        [710, 235],
      ],
      color: PURPLE,
      label: '같은 Key',
      labelY: 202,
    })
    .box({
      x: 55,
      y: 175,
      width: 160,
      height: 120,
      title: '생성 요청',
      detail: '요청 데이터',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 350,
      y: 165,
      width: 240,
      height: 140,
      title: 'IndexedDB',
      detail: 'Job ID + 요청 상태\n멱등성 Key',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .box({
      x: 710,
      y: 165,
      width: 230,
      height: 140,
      title: 'Server 작업',
      detail: '중복 요청은 같은\n논리 작업 반환',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .note({ x: 965, y: 205, width: 180, text: '새로고침 → 복구' })
    .text({ x: 55, y: 380, width: 250, text: '통합 생성 작업 상태', fontSize: 22, weight: 700 })
    .arrow({
      points: [
        [210, 490],
        [360, 490],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [505, 490],
        [655, 490],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [800, 490],
        [950, 490],
      ],
      color: GREEN,
    })
    .ellipse({ x: 70, y: 445, width: 140, height: 90, fill: FILLS.gray, stroke: MUTED })
    .text({ x: 70, y: 473, width: 140, text: '대기', fontSize: 18, align: 'center', weight: 700 })
    .ellipse({ x: 360, y: 445, width: 145, height: 90, fill: FILLS.purple, stroke: PURPLE })
    .text({ x: 360, y: 463, width: 145, text: '처리 중\nPolling ON', fontSize: 16, align: 'center', weight: 700 })
    .ellipse({ x: 655, y: 445, width: 145, height: 90, fill: FILLS.blue, stroke: BLUE })
    .text({ x: 655, y: 463, width: 145, text: 'Preview\n완료', fontSize: 16, align: 'center', weight: 700 })
    .ellipse({ x: 950, y: 445, width: 145, height: 90, fill: FILLS.green, stroke: GREEN })
    .text({ x: 950, y: 463, width: 145, text: 'Final 완료\nPolling OFF', fontSize: 16, align: 'center', weight: 700 });
  return diagram;
};

const createPlaybackLifecycleDiagram = () => {
  const diagram = new Diagram({
    name: 'kit-playback-resource-lifecycle',
    title: '모든 미디어 화면을 하나의 재생 상태로 제어',
    subtitle: '파일과 화면 생명주기에 맞춰 Resource를 정리하고, Mobile은 사용자 입력과 실제 재생 성공을 기다립니다.',
    project: 'Kit + Tool',
  });
  diagram
    .arrow({
      points: [
        [295, 220],
        [470, 290],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [295, 380],
        [470, 330],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [905, 220],
        [730, 290],
      ],
      color: TEAL,
    })
    .box({
      x: 55,
      y: 165,
      width: 240,
      height: 110,
      title: 'Audio Preview',
      detail: '재생 / 일시 정지 / 위치 이동',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 55,
      y: 325,
      width: 240,
      height: 110,
      title: '결과 Video',
      detail: '같은 위치 상태',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 905,
      y: 165,
      width: 240,
      height: 110,
      title: 'Multitrack',
      detail: '같은 재생 상태',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .ellipse({ x: 470, y: 210, width: 260, height: 200, fill: FILLS.yellow, stroke: ORANGE })
    .text({
      x: 470,
      y: 275,
      width: 260,
      text: '통합 재생 상태\n상태 + 위치',
      fontSize: 21,
      align: 'center',
      weight: 700,
    })
    .arrow({
      points: [
        [600, 410],
        [600, 505],
      ],
      color: RED,
      label: '파일 변경 / 화면 종료',
      labelX: 615,
      labelY: 445,
      labelWidth: 180,
    })
    .box({
      x: 390,
      y: 505,
      width: 420,
      height: 105,
      title: '정리 범위',
      detail: 'Media Instance + Object URL + Event + Timer',
      fill: FILLS.red,
      stroke: RED,
    })
    .note({ x: 815, y: 525, width: 330, text: 'Mobile: 입력 → 재생 성공 → UI 반영' });
  return diagram;
};

const createSubscriptionDiagram = () => {
  const diagram = new Diagram({
    name: 'kit-subscription-payment-flow',
    title: '구독 변경을 명시적인 상태 전이로 분리',
    subtitle: '적용 시점이 다른 전이를 구분하고, 진행 중인 같은 주문의 중복 실행을 막습니다.',
    project: 'Kit + Tool',
  });
  diagram
    .arrow({
      points: [
        [220, 250],
        [350, 250],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [590, 250],
        [720, 250],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [950, 250],
        [1060, 250],
      ],
      color: GREEN,
    })
    .box({
      x: 55,
      y: 190,
      width: 165,
      height: 120,
      title: '사전 검사',
      detail: '만료 + 크레딧',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 350,
      y: 170,
      width: 240,
      height: 160,
      title: '전이 선택',
      detail: '즉시 변경\n예약 변경·취소\n비례 정산',
      fill: FILLS.yellow,
      stroke: ORANGE,
    })
    .box({
      x: 720,
      y: 180,
      width: 230,
      height: 140,
      title: '주문 진행 중',
      detail: '같은 주문을\n다시 실행할 수 없음',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 1060,
      y: 190,
      width: 100,
      height: 120,
      title: '상태',
      detail: '반영',
      fill: FILLS.green,
      stroke: GREEN,
    })
    .arrow({
      points: [
        [835, 320],
        [835, 455],
      ],
      color: RED,
      label: '동기화 실패',
      labelX: 850,
      labelY: 365,
    })
    .arrow({
      points: [
        [720, 510],
        [590, 510],
        [590, 330],
      ],
      color: ORANGE,
      label: '주문 재동기화',
      labelX: 595,
      labelY: 475,
    })
    .box({
      x: 720,
      y: 455,
      width: 230,
      height: 110,
      title: '복구 경로',
      detail: '감지 + 재동기화',
      fill: FILLS.red,
      stroke: RED,
    })
    .note({ x: 120, y: 525, width: 390, text: '현재 구독 상태와 결제 결과를 분리' });
  return diagram;
};

const createShareFallbackDiagram = () => {
  const diagram = new Diagram({
    name: 'kit-share-fallback-flow',
    title: '공유 가능 여부를 확인한 뒤 전달 경로를 선택',
    subtitle: 'MIME Type과 파일 크기를 먼저 검사하고, 지원하지 않는 환경에는 링크 공유와 다운로드를 제공합니다.',
    project: 'Kit + Tool',
  });
  diagram
    .arrow({
      points: [
        [220, 280],
        [350, 280],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [550, 280],
        [690, 280],
      ],
      color: ORANGE,
    })
    .arrow({
      points: [
        [875, 235],
        [1010, 190],
      ],
      color: GREEN,
      label: '가능',
      labelX: 900,
      labelY: 170,
    })
    .arrow({
      points: [
        [875, 325],
        [1010, 430],
      ],
      color: RED,
      label: '불가',
      labelX: 900,
      labelY: 365,
    })
    .box({
      x: 55,
      y: 220,
      width: 165,
      height: 120,
      title: '결과 파일',
      detail: '결과 ID별 Cache',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 350,
      y: 200,
      width: 200,
      height: 160,
      title: '사전 검사',
      detail: '실제 MIME\n파일 크기\n준비된 파일',
      fill: FILLS.yellow,
      stroke: ORANGE,
    })
    .diamond({ x: 690, y: 200, width: 185, height: 160, text: 'canShare?' })
    .box({ x: 1010, y: 140, width: 145, height: 100, title: '파일 공유', fill: FILLS.green, stroke: GREEN })
    .box({
      x: 1010,
      y: 380,
      width: 145,
      height: 125,
      title: 'Fallback',
      detail: '링크 공유\n+ 다운로드',
      fill: FILLS.red,
      stroke: RED,
    })
    .note({ x: 305, y: 485, width: 590, text: '진행 중인 파일 준비 요청을 재사용해 중복 실행 방지' });
  return diagram;
};

const createSharePerformanceDiagram = () => {
  const diagram = new Diagram({
    name: 'kit-share-performance-comparison',
    title: '공유 파일 준비의 중복 작업 제거',
    subtitle: 'Network 개선은 하한값이고, Cache된 파일 준비 시간은 측정값입니다.',
    project: 'Kit + Tool',
  });
  diagram
    .rectangle({ x: 80, y: 175, width: 470, height: 300, fill: FILLS.blue, stroke: BLUE })
    .text({ x: 105, y: 205, width: 420, text: '공유 중복 실행', fontSize: 24, align: 'center', weight: 700 })
    .text({ x: 105, y: 285, width: 420, text: 'Network 요청', fontSize: 18, color: MUTED, align: 'center' })
    .text({ x: 105, y: 325, width: 420, text: '-50% 이상', fontSize: 43, color: BLUE, align: 'center', weight: 700 })
    .note({ x: 170, y: 410, width: 290, text: '진행 중인 요청 재사용' })
    .rectangle({ x: 650, y: 175, width: 470, height: 300, fill: FILLS.teal, stroke: TEAL })
    .text({ x: 675, y: 205, width: 420, text: 'Cache된 파일 준비', fontSize: 24, align: 'center', weight: 700 })
    .text({
      x: 675,
      y: 285,
      width: 420,
      text: '209 ms  ->  102 ms',
      fontSize: 34,
      color: TEAL,
      align: 'center',
      weight: 700,
    })
    .text({ x: 675, y: 350, width: 420, text: '-51.2%', fontSize: 30, color: TEAL, align: 'center', weight: 700 })
    .note({ x: 740, y: 410, width: 290, text: '결과 ID 파일 Cache', color: TEAL })
    .text({
      x: 155,
      y: 545,
      width: 890,
      text: '두 수치는 서로 다른 처리 방식과 측정 범위를 설명합니다.',
      fontSize: 19,
      color: MUTED,
      align: 'center',
    });
  return diagram;
};

const createKitObservabilityDiagram = () => {
  const diagram = new Diagram({
    name: 'kit-observability-flow',
    title: '제품 Event와 오류 기록으로 서로 다른 장애 질문에 답하기',
    subtitle: 'GA4는 영향받은 여정 단계를, Sentry는 실패의 기술 Context를 기록합니다.',
    project: 'Kit + Tool',
  });
  diagram
    .arrow({
      points: [
        [250, 285],
        [400, 215],
      ],
      color: BLUE,
      label: '여정 Event',
      labelX: 240,
      labelY: 205,
    })
    .arrow({
      points: [
        [250, 325],
        [400, 420],
      ],
      color: RED,
      label: '오류 Context',
      labelX: 250,
      labelY: 375,
    })
    .arrow({
      points: [
        [650, 215],
        [790, 300],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [650, 420],
        [790, 340],
      ],
      color: RED,
    })
    .box({
      x: 55,
      y: 235,
      width: 195,
      height: 130,
      title: '사용자 여정',
      detail: '생성 + 미디어',
      fill: FILLS.gray,
      stroke: MUTED,
    })
    .box({
      x: 400,
      y: 155,
      width: 250,
      height: 120,
      title: 'GA4',
      detail: '단계 + 실패 Event',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 400,
      y: 360,
      width: 250,
      height: 120,
      title: 'Sentry',
      detail: '위치 + 브라우저 + 경로',
      fill: FILLS.red,
      stroke: RED,
    })
    .ellipse({ x: 790, y: 215, width: 300, height: 200, fill: FILLS.purple, stroke: PURPLE })
    .text({
      x: 790,
      y: 270,
      width: 300,
      text: '함께 분석\n영향 단계 +\n재현 Context',
      fontSize: 21,
      align: 'center',
      weight: 700,
    })
    .note({ x: 420, y: 555, width: 360, text: '근거를 바탕으로 대응 우선순위 결정' });
  return diagram;
};

const createSeoDiagram = () => {
  const diagram = new Diagram({
    name: 'main-multilingual-seo-structure',
    title: '다국어 Route를 기준으로 SEO 구조 통합',
    subtitle: 'Routing, Canonical, Redirect, 구조화 데이터, 크롤링 파일이 공개 콘텐츠 모델을 함께 사용합니다.',
    project: 'AnAI Main',
  });
  diagram
    .arrow({
      points: [
        [235, 290],
        [360, 290],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [590, 290],
        [710, 195],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [590, 290],
        [710, 290],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [590, 290],
        [710, 385],
      ],
      color: PURPLE,
    })
    .box({
      x: 55,
      y: 225,
      width: 180,
      height: 130,
      title: 'CMS 콘텐츠',
      detail: '언어 + 공개 상태',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 360,
      y: 210,
      width: 230,
      height: 160,
      title: 'Locale Route',
      detail: '/ko/...\n/en/...\nnews slug',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 710,
      y: 140,
      width: 230,
      height: 110,
      title: 'Metadata',
      detail: 'Meta + Canonical',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .box({
      x: 710,
      y: 270,
      width: 230,
      height: 110,
      title: 'JSON-LD',
      detail: '기사 구조',
      fill: FILLS.orange,
      stroke: ORANGE,
    })
    .box({
      x: 710,
      y: 400,
      width: 230,
      height: 110,
      title: 'Sitemap + Robots',
      detail: '공개 콘텐츠로 생성',
      fill: FILLS.green,
      stroke: GREEN,
    })
    .arrow({
      points: [
        [940, 195],
        [1050, 195],
      ],
      color: TEAL,
    })
    .arrow({
      points: [
        [940, 325],
        [1050, 325],
      ],
      color: ORANGE,
    })
    .arrow({
      points: [
        [940, 455],
        [1050, 455],
      ],
      color: GREEN,
    })
    .box({
      x: 1050,
      y: 140,
      width: 110,
      height: 370,
      title: '검색',
      detail: '안정된\n진입 경로',
      fill: FILLS.yellow,
      stroke: ORANGE,
      centerContent: true,
    })
    .note({ x: 100, y: 505, width: 470, text: '기존 뉴스 URL을 새 Route로 Redirect' });
  return diagram;
};

const createMainPerformanceDiagram = () => {
  const diagram = new Diagram({
    name: 'main-delivery-performance-comparison',
    title: '전송 성능을 정규화 지수로 비교',
    subtitle: '글에는 감소율만 있고 원시 시간·용량 값이 없어 적용 전 기준을 100으로 두었습니다.',
    project: 'AnAI Main',
  });
  diagram
    .rectangle({ x: 90, y: 170, width: 470, height: 310, fill: FILLS.blue, stroke: BLUE })
    .text({ x: 115, y: 205, width: 420, text: '초기 콘텐츠 표시', fontSize: 24, align: 'center', weight: 700 })
    .text({
      x: 135,
      y: 295,
      width: 140,
      text: '적용 전\n100',
      fontSize: 24,
      color: MUTED,
      align: 'center',
      weight: 700,
    })
    .arrow({
      points: [
        [300, 335],
        [380, 335],
      ],
      color: BLUE,
    })
    .text({ x: 390, y: 295, width: 140, text: '적용 후\n33', fontSize: 31, color: BLUE, align: 'center', weight: 700 })
    .note({ x: 175, y: 410, width: 300, text: '67% 감소' })
    .rectangle({ x: 640, y: 170, width: 470, height: 310, fill: FILLS.teal, stroke: TEAL })
    .text({ x: 665, y: 205, width: 420, text: 'HTML + JS + CSS 전송량', fontSize: 24, align: 'center', weight: 700 })
    .text({
      x: 685,
      y: 295,
      width: 140,
      text: '적용 전\n100',
      fontSize: 24,
      color: MUTED,
      align: 'center',
      weight: 700,
    })
    .arrow({
      points: [
        [850, 335],
        [930, 335],
      ],
      color: TEAL,
    })
    .text({
      x: 940,
      y: 295,
      width: 140,
      text: '적용 후\n37.4',
      fontSize: 31,
      color: TEAL,
      align: 'center',
      weight: 700,
    })
    .note({ x: 725, y: 410, width: 300, text: '62.6% 감소', color: TEAL })
    .text({
      x: 180,
      y: 545,
      width: 840,
      text: '정규화 지수는 글에 제시된 비율 변화만 나타냅니다.',
      fontSize: 19,
      color: MUTED,
      align: 'center',
    });
  return diagram;
};

const createCmsFallbackDiagram = () => {
  const diagram = new Diagram({
    name: 'main-cms-fallback-flow',
    title: 'CMS 장애를 기본 사이트 Build와 격리',
    subtitle: '브랜드 페이지는 독립적으로 Build하고, 뉴스는 Strapi, 최근 데이터, Server Fallback 순으로 조회합니다.',
    project: 'AnAI Main',
  });
  diagram
    .text({ x: 55, y: 145, width: 250, text: 'Build 경로', fontSize: 21, color: BLUE, weight: 700 })
    .arrow({
      points: [
        [225, 230],
        [370, 230],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [585, 230],
        [730, 230],
      ],
      color: GREEN,
    })
    .box({ x: 55, y: 185, width: 170, height: 90, title: '기본 사이트', fill: FILLS.blue, stroke: BLUE })
    .box({
      x: 370,
      y: 175,
      width: 215,
      height: 110,
      title: 'SEO pipeline',
      detail: 'CMS 조회 격리',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({ x: 730, y: 185, width: 240, height: 90, title: '브랜드 Build 완료', fill: FILLS.green, stroke: GREEN })
    .line({
      points: [
        [55, 330],
        [1145, 330],
      ],
      color: '#ced4da',
      dashed: true,
    })
    .text({ x: 55, y: 360, width: 250, text: '뉴스 데이터 경로', fontSize: 21, color: PURPLE, weight: 700 })
    .arrow({
      points: [
        [220, 465],
        [350, 465],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [540, 465],
        [675, 465],
      ],
      color: ORANGE,
      label: '실패 시',
      labelY: 432,
    })
    .arrow({
      points: [
        [865, 465],
        [1000, 465],
      ],
      color: RED,
      label: '실패 시',
      labelY: 432,
    })
    .box({ x: 55, y: 415, width: 165, height: 100, title: '뉴스 요청', fill: FILLS.purple, stroke: PURPLE })
    .box({
      x: 350,
      y: 405,
      width: 190,
      height: 120,
      title: 'Strapi',
      detail: '실시간 콘텐츠',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 675,
      y: 405,
      width: 190,
      height: 120,
      title: '최근 데이터',
      detail: '마지막 성공 조회',
      fill: FILLS.orange,
      stroke: ORANGE,
    })
    .box({
      x: 1000,
      y: 405,
      width: 145,
      height: 120,
      title: 'Fallback',
      detail: '최종 경로',
      fill: FILLS.red,
      stroke: RED,
    })
    .note({ x: 340, y: 570, width: 520, text: '응답 변환, Cache, SEO Mapping을 공통 흐름으로 관리' });
  return diagram;
};

const createDeploymentDiagram = () => {
  const diagram = new Diagram({
    name: 'main-aws-deployment-flow',
    title: 'Branch별 Image를 하나의 자동화 Pipeline으로 배포',
    subtitle: 'Next.js Standalone으로 Runtime을 고정하고, 운영·개발 Image는 Amazon ECR에서 분리합니다.',
    project: 'AnAI Main',
  });
  diagram
    .arrow({
      points: [
        [225, 270],
        [340, 270],
      ],
      color: BLUE,
    })
    .arrow({
      points: [
        [545, 270],
        [660, 270],
      ],
      color: PURPLE,
    })
    .arrow({
      points: [
        [865, 270],
        [980, 270],
      ],
      color: TEAL,
    })
    .box({
      x: 55,
      y: 205,
      width: 170,
      height: 130,
      title: 'Branch 반영',
      detail: '운영 또는 개발',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .box({
      x: 340,
      y: 195,
      width: 205,
      height: 150,
      title: 'GitHub Actions',
      detail: '설치 + Build\n상태 알림',
      fill: FILLS.purple,
      stroke: PURPLE,
    })
    .box({
      x: 660,
      y: 195,
      width: 205,
      height: 150,
      title: 'Docker Image',
      detail: 'Next.js Standalone\n고정 Runtime',
      fill: FILLS.teal,
      stroke: TEAL,
    })
    .box({
      x: 980,
      y: 205,
      width: 165,
      height: 130,
      title: 'Amazon ECR',
      detail: 'Image Registry',
      fill: FILLS.green,
      stroke: GREEN,
    })
    .arrow({
      points: [
        [1060, 335],
        [1060, 455],
        [850, 455],
      ],
      color: ORANGE,
    })
    .box({
      x: 650,
      y: 420,
      width: 200,
      height: 100,
      title: '운영 Image',
      detail: '별도 Tag / Repository',
      fill: FILLS.orange,
      stroke: ORANGE,
    })
    .box({
      x: 920,
      y: 500,
      width: 220,
      height: 100,
      title: '개발 Image',
      detail: '운영 Image 덮어쓰기 방지',
      fill: FILLS.blue,
      stroke: BLUE,
    })
    .arrow({
      points: [
        [1060, 455],
        [1060, 500],
      ],
      color: BLUE,
    })
    .note({ x: 115, y: 475, width: 390, text: 'PR과 배포 결과 자동 알림' });
  return diagram;
};

const buildDiagrams = () => [
  createEditorStateDiagram(),
  createLocalFirstDiagram(),
  createEditorPerformanceDiagram(),
  createEditorMediaFlowDiagram(),
  createAudioPerformanceDiagram(),
  createAudioFlowDiagram(),
  createExportDiagram(),
  createRecoveryDiagram(),
  createGenerationRecoveryDiagram(),
  createPlaybackLifecycleDiagram(),
  createSubscriptionDiagram(),
  createShareFallbackDiagram(),
  createSharePerformanceDiagram(),
  createKitObservabilityDiagram(),
  createSeoDiagram(),
  createMainPerformanceDiagram(),
  createCmsFallbackDiagram(),
  createDeploymentDiagram(),
  createAudioRegionPerformanceDiagram(),
];

const findPotentialTextOverflows = diagrams =>
  diagrams.flatMap(diagram =>
    diagram.primitives
      .filter(
        primitive =>
          primitive.type === 'text' &&
          primitive.width != null &&
          estimateTextWidth(primitive.text, primitive.fontSize) > primitive.width
      )
      .map(primitive => `${diagram.name}: ${primitive.text.replaceAll('\n', ' / ')}`)
  );

const renderText = primitive => {
  const lines = primitive.text.split('\n');
  const anchor = primitive.align === 'center' ? 'middle' : primitive.align === 'right' ? 'end' : 'start';
  const x =
    primitive.align === 'center'
      ? primitive.x + primitive.width / 2
      : primitive.align === 'right'
        ? primitive.x + primitive.width
        : primitive.x;
  const lineHeight = primitive.fontSize * TEXT_LINE_HEIGHT;
  const spans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${primitive.y + primitive.fontSize}" text-anchor="${anchor}" font-size="${primitive.fontSize}" font-weight="${primitive.weight}" fill="${primitive.color}">${spans}</text>`;
};

const createRoughOptions = (primitive, index) => ({
  seed: hashSeed(`${primitive.type}-${index}-${primitive.x}-${primitive.y}`),
  roughness: ARTIST_ROUGHNESS,
  stroke: primitive.stroke ?? primitive.color,
  strokeWidth: primitive.type === 'line' ? (primitive.width ?? 2.2) : 2.2,
  fill: primitive.fill === 'transparent' ? undefined : primitive.fill,
  fillStyle: 'solid',
  strokeLineDash: primitive.dashed ? [9, 8] : undefined,
});

const renderRoughDrawable = (drawable, { opacity = 1, markerId } = {}) => {
  const paths = roughGenerator.toPaths(drawable);
  return paths
    .map((pathInfo, index) => {
      const fillOpacity = pathInfo.fill !== 'none' ? ` fill-opacity="${opacity}"` : '';
      const marker = markerId && index === paths.length - 1 ? ` marker-end="url(#${markerId})"` : '';
      return `<path d="${pathInfo.d}" stroke="${pathInfo.stroke}" stroke-width="${pathInfo.strokeWidth}" fill="${pathInfo.fill}"${fillOpacity}${marker} stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
};

const createRoundedRectanglePath = primitive => {
  const radius = Math.min(primitive.radius, primitive.width / 2, primitive.height / 2);
  const right = primitive.x + primitive.width;
  const bottom = primitive.y + primitive.height;
  return [
    `M ${primitive.x + radius} ${primitive.y}`,
    `L ${right - radius} ${primitive.y}`,
    `Q ${right} ${primitive.y} ${right} ${primitive.y + radius}`,
    `L ${right} ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `L ${primitive.x + radius} ${bottom}`,
    `Q ${primitive.x} ${bottom} ${primitive.x} ${bottom - radius}`,
    `L ${primitive.x} ${primitive.y + radius}`,
    `Q ${primitive.x} ${primitive.y} ${primitive.x + radius} ${primitive.y}`,
    'Z',
  ].join(' ');
};

const renderRectangle = (primitive, index) =>
  renderRoughDrawable(
    roughGenerator.path(createRoundedRectanglePath(primitive), createRoughOptions(primitive, index)),
    {
      opacity: primitive.opacity,
    }
  );

const renderEllipse = (primitive, index) =>
  renderRoughDrawable(
    roughGenerator.ellipse(
      primitive.x + primitive.width / 2,
      primitive.y + primitive.height / 2,
      primitive.width,
      primitive.height,
      createRoughOptions(primitive, index)
    )
  );

const renderDiamond = (primitive, index) => {
  const points = [
    [primitive.x + primitive.width / 2, primitive.y],
    [primitive.x + primitive.width, primitive.y + primitive.height / 2],
    [primitive.x + primitive.width / 2, primitive.y + primitive.height],
    [primitive.x, primitive.y + primitive.height / 2],
  ];
  return renderRoughDrawable(roughGenerator.polygon(points, createRoughOptions(primitive, index)));
};

const renderPath = (primitive, index) => {
  const markerId = `arrowhead-${primitive.color.replaceAll('#', '')}`;
  return renderRoughDrawable(roughGenerator.linearPath(primitive.points, createRoughOptions(primitive, index)), {
    markerId: primitive.type === 'arrow' ? markerId : undefined,
  });
};

const renderSvg = (diagram, { excalifontDataUrl, xiaolaiDataUrl }) => {
  const orderedPrimitives = [
    ...diagram.primitives.filter(primitive => primitive.type !== 'text'),
    ...diagram.primitives.filter(primitive => primitive.type === 'text'),
  ];
  const renderedPrimitives = orderedPrimitives
    .map((primitive, index) => {
      if (primitive.type === 'text') {
        return renderText(primitive);
      }
      if (primitive.type === 'rectangle') {
        return renderRectangle(primitive, index);
      }
      if (primitive.type === 'ellipse') {
        return renderEllipse(primitive, index);
      }
      if (primitive.type === 'diamond') {
        return renderDiamond(primitive, index);
      }
      return renderPath(primitive, index);
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" role="img">
  <title>${escapeXml(diagram.title)}</title>
  <desc>${escapeXml(diagram.subtitle)}</desc>
  <defs>
    <style>
      @font-face { font-family: 'Excalifont'; src: url('${excalifontDataUrl}') format('woff2'); font-weight: 400 700; font-style: normal; }
      @font-face { font-family: 'Xiaolai'; src: url('${xiaolaiDataUrl}') format('woff2'); font-weight: 400 700; font-style: normal; }
      text { font-family: 'Excalifont', 'Xiaolai', sans-serif; }
    </style>
    ${[INK, MUTED, PURPLE, BLUE, TEAL, GREEN, ORANGE, RED]
      .map(
        color => `<marker id="arrowhead-${color.replaceAll('#', '')}" markerWidth="12" markerHeight="12" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
    </marker>`
      )
      .join('\n    ')}
  </defs>
  <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="${CANVAS_COLOR}"/>
  ${renderedPrimitives}
</svg>
`;
};

const convertPrimitiveToElements = primitive => {
  if (primitive.type === 'rectangle') {
    return [createRectangleElement(primitive)];
  }
  if (primitive.type === 'ellipse') {
    return [createEllipseElement(primitive)];
  }
  if (primitive.type === 'diamond') {
    return [createDiamondElement(primitive)];
  }
  if (primitive.type === 'text') {
    return [createTextElement(primitive)];
  }
  if (primitive.type === 'arrow') {
    return [createArrowElement(primitive)];
  }
  if (primitive.type === 'line') {
    return [
      createArrowElement({
        ...primitive,
        type: 'arrow',
        dashed: primitive.dashed,
        points: primitive.points,
        color: primitive.color,
        endArrowhead: null,
      }),
    ].map(element => ({ ...element, type: 'line', endArrowhead: null }));
  }
  return [];
};

const renderExcalidraw = diagram => ({
  type: 'excalidraw',
  version: 2,
  source: '',
  elements: [
    ...diagram.primitives.filter(primitive => primitive.type !== 'text'),
    ...diagram.primitives.filter(primitive => primitive.type === 'text'),
  ].flatMap(convertPrimitiveToElements),
  appState: {
    gridSize: null,
    viewBackgroundColor: CANVAS_COLOR,
  },
  files: {},
});

const main = async () => {
  const [excalifont, xiaolai] = await Promise.all([readFile(EXCALIFONT_PATH), readFile(XIAOLAI_KOREAN_PATH)]);
  const fontDataUrls = {
    excalifontDataUrl: `data:font/woff2;base64,${excalifont.toString('base64')}`,
    xiaolaiDataUrl: `data:font/woff2;base64,${xiaolai.toString('base64')}`,
  };
  const diagrams = buildDiagrams();
  const potentialTextOverflows = findPotentialTextOverflows(diagrams);
  if (potentialTextOverflows.length > 0) {
    throw new Error(`Text exceeds its layout width:\n${potentialTextOverflows.join('\n')}`);
  }
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await mkdir(SOURCE_DIRECTORY, { recursive: true });

  await Promise.all(
    diagrams.flatMap(diagram => [
      writeFile(path.join(OUTPUT_DIRECTORY, `${diagram.name}.svg`), renderSvg(diagram, fontDataUrls), 'utf8'),
      writeFile(
        path.join(SOURCE_DIRECTORY, `${diagram.name}.excalidraw`),
        `${JSON.stringify(renderExcalidraw(diagram), null, 2)}\n`,
        'utf8'
      ),
    ])
  );

  console.log(`Generated ${diagrams.length} SVG diagrams and ${diagrams.length} editable Excalidraw sources.`);
};

await main();
