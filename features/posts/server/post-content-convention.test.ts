import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface MarkdownFence {
  character: '`' | '~';
  length: number;
}

interface HeadingNumberingState {
  currentTopLevelNumber: number | null;
  nextSecondLevelNumber: number;
  nextTopLevelNumber: number;
}

const POSTS_DIRECTORY = new URL('../../../content/posts/', import.meta.url);
const POST_FILE_PATTERN = /\.md$/;
const FENCED_CODE_BLOCK_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;
const MARKDOWN_HEADING_PATTERN = /^\s{0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const TABLE_OF_CONTENTS_TAG_PATTERN = /^\[sort([1-3])\][ \t]+/;
const TOP_LEVEL_HEADING_PATTERN = /^\d+\.[ \t]+/;
const SECOND_LEVEL_HEADING_PATTERN = /^\d+-\d+\.[ \t]+/;
const REFERENCE_HEADING = '참고';

describe('post content convention', () => {
  it('uses one generated table-of-contents hierarchy across every post', () => {
    const violations = readdirSync(POSTS_DIRECTORY)
      .filter(fileName => POST_FILE_PATTERN.test(fileName))
      .sort()
      .flatMap(findHeadingViolations);

    expect(violations).toEqual([]);
  });
});

function findHeadingViolations(fileName: string): string[] {
  const content = readFileSync(new URL(fileName, POSTS_DIRECTORY), 'utf8');
  const violations: string[] = [];
  const numberingState: HeadingNumberingState = {
    currentTopLevelNumber: null,
    nextSecondLevelNumber: 1,
    nextTopLevelNumber: 1,
  };
  let activeFence: MarkdownFence | null = null;
  let hasTableOfContentsHeading = false;

  content.split(/\r?\n/).forEach((line, index) => {
    const fence = findMarkdownFence(line);

    if (activeFence != null) {
      if (isClosingMarkdownFence({ activeFence, fence })) {
        activeFence = null;
      }

      return;
    }

    if (fence != null) {
      activeFence = fence;
      return;
    }

    const headingMatch = MARKDOWN_HEADING_PATTERN.exec(line);

    if (headingMatch == null) {
      return;
    }

    const level = headingMatch[1].length;
    const title = headingMatch[2];
    const formatViolation = getHeadingViolation({ level, title });

    if (formatViolation != null) {
      violations.push(`${fileName}:${index + 1} ${formatViolation}: ${line}`);
      return;
    }

    if (level === 2 && title !== REFERENCE_HEADING) {
      hasTableOfContentsHeading = true;
    }

    const numberingViolation = getHeadingNumberingViolation({ level, numberingState, title });

    if (numberingViolation != null) {
      violations.push(`${fileName}:${index + 1} ${numberingViolation}: ${line}`);
    }
  });

  if (!hasTableOfContentsHeading) {
    violations.push(`${fileName}: 사이드 목차에 표시할 H2가 없습니다`);
  }

  return violations;
}

function getHeadingViolation({ level, title }: { level: number; title: string }): string | null {
  const tableOfContentsTag = TABLE_OF_CONTENTS_TAG_PATTERN.exec(title);
  const visibleTitle = title.replace(TABLE_OF_CONTENTS_TAG_PATTERN, '');

  if (level === 1) {
    return 'frontmatter 제목과 중복되는 본문 H1을 사용할 수 없습니다';
  }

  if (level >= 4) {
    return '본문 제목 깊이는 H3까지만 사용할 수 있습니다';
  }

  if (level === 2 && visibleTitle === REFERENCE_HEADING) {
    return tableOfContentsTag == null ? null : '참고 섹션은 사이드 목차에서 제외해야 합니다';
  }

  if (level === 2 && (tableOfContentsTag?.[1] !== '1' || !TOP_LEVEL_HEADING_PATTERN.test(visibleTitle))) {
    return 'H2는 `[sort1] N. 제목` 형식을 사용해야 합니다';
  }

  if (level === 3 && (tableOfContentsTag?.[1] !== '2' || !SECOND_LEVEL_HEADING_PATTERN.test(visibleTitle))) {
    return 'H3는 `[sort2] N-N. 제목` 형식을 사용해야 합니다';
  }

  return null;
}

function getHeadingNumberingViolation({
  level,
  numberingState,
  title,
}: {
  level: number;
  numberingState: HeadingNumberingState;
  title: string;
}): string | null {
  const visibleTitle = title.replace(TABLE_OF_CONTENTS_TAG_PATTERN, '');

  if (level === 2 && visibleTitle === REFERENCE_HEADING) {
    return null;
  }

  if (level === 2) {
    const headingNumber = Number.parseInt(visibleTitle, 10);
    const expectedHeadingNumber = numberingState.nextTopLevelNumber;
    numberingState.currentTopLevelNumber = headingNumber;
    numberingState.nextSecondLevelNumber = 1;
    numberingState.nextTopLevelNumber = headingNumber + 1;

    return headingNumber === expectedHeadingNumber ? null : `H2 번호는 ${expectedHeadingNumber}이어야 합니다`;
  }

  if (level === 3) {
    const headingNumberMatch = /^(\d+)-(\d+)\./.exec(visibleTitle);
    const parentHeadingNumber = Number.parseInt(headingNumberMatch?.[1] ?? '', 10);
    const headingNumber = Number.parseInt(headingNumberMatch?.[2] ?? '', 10);
    const expectedParentHeadingNumber = numberingState.currentTopLevelNumber;
    const expectedHeadingNumber = numberingState.nextSecondLevelNumber;
    numberingState.nextSecondLevelNumber = headingNumber + 1;

    if (parentHeadingNumber !== expectedParentHeadingNumber) {
      return `H3의 상위 번호는 ${expectedParentHeadingNumber ?? '없음'}이어야 합니다`;
    }

    return headingNumber === expectedHeadingNumber
      ? null
      : `H3 번호는 ${parentHeadingNumber}-${expectedHeadingNumber}이어야 합니다`;
  }

  return null;
}

function findMarkdownFence(line: string): MarkdownFence | null {
  const fenceSequence = FENCED_CODE_BLOCK_PATTERN.exec(line)?.[1];

  if (fenceSequence == null) {
    return null;
  }

  return {
    character: fenceSequence[0] as MarkdownFence['character'],
    length: fenceSequence.length,
  };
}

function isClosingMarkdownFence({
  activeFence,
  fence,
}: {
  activeFence: MarkdownFence;
  fence: MarkdownFence | null;
}): boolean {
  return fence?.character === activeFence.character && fence.length >= activeFence.length;
}
