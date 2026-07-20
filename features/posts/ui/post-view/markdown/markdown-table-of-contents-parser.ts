import {
  createMarkdownHeadingSlug,
  createUniqueMarkdownHeadingId,
  EMPTY_MARKDOWN_HEADING_ID,
  normalizeMarkdownHeadingTitle,
} from './markdown-heading-id';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents-types';

interface MarkdownHeading {
  level: 2 | 3 | 4;
  title: string;
}

interface PreparedMarkdownContent {
  content: string;
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

const TABLE_OF_CONTENTS_HEADINGS = new Set(['## 목차', '## Table of contents']);
const ORDERED_LIST_ITEM_PATTERN = /^\d+\.\s+(.+?)\s*$/;
const MARKDOWN_HEADING_PATTERN = /^(#{2,4})\s+(.+?)\s*$/;

export function hasMarkdownTableOfContents(content: string): boolean {
  return content.split('\n').some(isTableOfContentsHeading);
}

export function extractMarkdownTableOfContents(content: string): PreparedMarkdownContent {
  const lines = content.split('\n');
  const headingIndex = lines.findIndex(isTableOfContentsHeading);

  if (headingIndex === -1) {
    return { content, tableOfContentsItems: [] };
  }

  const listStartIndex = findNextContentLineIndex({ lines, startIndex: headingIndex + 1 });

  if (listStartIndex == null) {
    return {
      content: removeTableOfContentsSource({ endIndex: headingIndex + 1, headingIndex, lines }),
      tableOfContentsItems: [],
    };
  }

  const collectedList = collectOrderedListItems({ lines, startIndex: listStartIndex });
  const sourceEndIndex = collectedList.titles.length > 0 ? collectedList.endIndex : headingIndex + 1;
  const headings = collectMarkdownHeadings(lines.slice(collectedList.endIndex));

  return {
    content: removeTableOfContentsSource({ endIndex: sourceEndIndex, headingIndex, lines }),
    tableOfContentsItems: createTableOfContentsItems({ headings, titles: collectedList.titles }),
  };
}

function isTableOfContentsHeading(line: string): boolean {
  return TABLE_OF_CONTENTS_HEADINGS.has(line.trim());
}

function removeTableOfContentsSource({
  endIndex,
  headingIndex,
  lines,
}: {
  endIndex: number;
  headingIndex: number;
  lines: string[];
}): string {
  return [...lines.slice(0, headingIndex), ...lines.slice(endIndex)].join('\n').trimStart();
}

function findNextContentLineIndex({ lines, startIndex }: { lines: string[]; startIndex: number }): number | null {
  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex]?.trim() !== '') {
      return lineIndex;
    }
  }

  return null;
}

function collectOrderedListItems({ lines, startIndex }: { lines: string[]; startIndex: number }): {
  endIndex: number;
  titles: string[];
} {
  const titles: string[] = [];
  let currentIndex = startIndex;

  while (currentIndex < lines.length) {
    const itemMatch = ORDERED_LIST_ITEM_PATTERN.exec(lines[currentIndex]?.trim() ?? '');

    if (itemMatch == null) {
      break;
    }

    titles.push(itemMatch[1]);
    currentIndex += 1;
  }

  return { endIndex: currentIndex, titles };
}

function collectMarkdownHeadings(lines: string[]): MarkdownHeading[] {
  return lines.flatMap(line => {
    const headingMatch = MARKDOWN_HEADING_PATTERN.exec(line.trim());

    if (headingMatch == null) {
      return [];
    }

    return [{ level: headingMatch[1].length as MarkdownHeading['level'], title: headingMatch[2] }];
  });
}

function createTableOfContentsItems({
  headings,
  titles,
}: {
  headings: MarkdownHeading[];
  titles: string[];
}): MarkdownTableOfContentsItem[] {
  const usedIdCounts = new Map<string, number>();
  const selectedHeadings =
    titles.length > 0
      ? titles.map((title, index) => ({
          idSourceTitle: headings[index]?.title ?? title,
          level: headings[index]?.level ?? 2,
          title,
        }))
      : headings.map(heading => ({ ...heading, idSourceTitle: heading.title }));

  return selectedHeadings.map(({ idSourceTitle, level, title }, index) => {
    const fallbackId = `${EMPTY_MARKDOWN_HEADING_ID}-${index + 1}`;
    const baseId = createMarkdownHeadingSlug(normalizeMarkdownHeadingTitle(idSourceTitle)) ?? fallbackId;

    return {
      id: createUniqueMarkdownHeadingId({ baseId, usedIdCounts }),
      level,
      title,
    };
  });
}
