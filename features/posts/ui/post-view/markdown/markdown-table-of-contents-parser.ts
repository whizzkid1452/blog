import {
  createMarkdownHeadingSlug,
  createUniqueMarkdownHeadingId,
  EMPTY_MARKDOWN_HEADING_ID,
  normalizeMarkdownHeadingTitle,
} from './markdown-heading-id';
import type { MarkdownTableOfContentsDepth, MarkdownTableOfContentsItem } from './markdown-table-of-contents-types';

interface PreparedMarkdownContent {
  content: string;
  headingIds: string[];
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

interface MarkdownFence {
  character: '`' | '~';
  length: number;
}

const FENCED_CODE_BLOCK_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;
const MARKDOWN_HEADING_PATTERN = /^\s{0,3}#{2,4}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const TAGGED_MARKDOWN_HEADING_PATTERN = /^(\s{0,3}#{2,4}[ \t]+)\[sort([1-3])\][ \t]+(.+?)[ \t]*$/;

export function hasMarkdownTableOfContents(content: string): boolean {
  return parseMarkdownTableOfContents(content).tableOfContentsItems.length > 0;
}

export function extractMarkdownTableOfContents(content: string): PreparedMarkdownContent {
  return parseMarkdownTableOfContents(content);
}

function parseMarkdownTableOfContents(content: string): PreparedMarkdownContent {
  const headingIds: string[] = [];
  const tableOfContentsItems: MarkdownTableOfContentsItem[] = [];
  const usedIdCounts = new Map<string, number>();
  let activeFence: MarkdownFence | null = null;

  const preparedLines = content.split('\n').map(line => {
    const fence = findMarkdownFence(line);

    if (activeFence != null) {
      if (isClosingMarkdownFence({ activeFence, fence })) {
        activeFence = null;
      }

      return line;
    }

    if (fence != null) {
      activeFence = fence;
      return line;
    }

    const taggedHeadingMatch = TAGGED_MARKDOWN_HEADING_PATTERN.exec(line);
    const preparedLine = taggedHeadingMatch == null ? line : `${taggedHeadingMatch[1]}${taggedHeadingMatch[3]}`;
    const headingMatch = MARKDOWN_HEADING_PATTERN.exec(preparedLine);

    if (headingMatch == null) {
      return preparedLine;
    }

    const title = headingMatch[1];
    const fallbackId = `${EMPTY_MARKDOWN_HEADING_ID}-${headingIds.length + 1}`;
    const baseId = createMarkdownHeadingSlug(normalizeMarkdownHeadingTitle(title)) ?? fallbackId;
    const id = createUniqueMarkdownHeadingId({ baseId, usedIdCounts });
    headingIds.push(id);

    if (taggedHeadingMatch != null) {
      tableOfContentsItems.push({
        depth: Number(taggedHeadingMatch[2]) as MarkdownTableOfContentsDepth,
        id,
        title,
      });
    }

    return preparedLine;
  });

  return {
    content: preparedLines.join('\n'),
    headingIds,
    tableOfContentsItems,
  };
}

function findMarkdownFence(line: string): MarkdownFence | null {
  const fenceMatch = FENCED_CODE_BLOCK_PATTERN.exec(line);
  const fenceSequence = fenceMatch?.[1];

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
