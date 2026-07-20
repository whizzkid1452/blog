import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents-types';

interface CreateMarkdownHeadingIdResolverParams {
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

interface MarkdownHeadingIdResolver {
  resolveId: (headingText: string) => string;
}

interface CreateUniqueHeadingIdParams {
  baseId: string;
  usedIdCounts: Map<string, number>;
}

const LEADING_SECTION_NUMBER_PATTERN = /^\d+(?:-\d+)*\.\s*/;
const NON_SLUG_CHARACTER_PATTERN = /[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g;
const SLUG_SEPARATOR_PATTERN = /^-+|-+$/g;
export const EMPTY_MARKDOWN_HEADING_ID = 'section';

export function createMarkdownHeadingIdResolver({
  tableOfContentsItems,
}: CreateMarkdownHeadingIdResolverParams): MarkdownHeadingIdResolver {
  const idByComparableTitle = new Map(
    tableOfContentsItems.map(item => [normalizeMarkdownHeadingTitle(item.title), item.id] as const)
  );
  const usedIdCounts = new Map<string, number>();

  return {
    resolveId(headingText) {
      const comparableTitle = normalizeMarkdownHeadingTitle(headingText);
      const baseId =
        idByComparableTitle.get(comparableTitle) ??
        createMarkdownHeadingSlug(comparableTitle) ??
        EMPTY_MARKDOWN_HEADING_ID;

      return createUniqueMarkdownHeadingId({ baseId, usedIdCounts });
    },
  };
}

export function normalizeMarkdownHeadingTitle(headingText: string): string {
  return headingText.trim().replace(LEADING_SECTION_NUMBER_PATTERN, '').trim();
}

export function createMarkdownHeadingSlug(text: string): string | null {
  const slug = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(NON_SLUG_CHARACTER_PATTERN, '-')
    .replace(SLUG_SEPARATOR_PATTERN, '');

  return slug === '' ? null : slug;
}

export function createUniqueMarkdownHeadingId({ baseId, usedIdCounts }: CreateUniqueHeadingIdParams): string {
  const usedCount = usedIdCounts.get(baseId) ?? 0;
  usedIdCounts.set(baseId, usedCount + 1);

  return usedCount === 0 ? baseId : `${baseId}-${usedCount + 1}`;
}
