interface CreateMarkdownHeadingIdResolverParams {
  headingIds: string[];
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
  headingIds,
}: CreateMarkdownHeadingIdResolverParams): MarkdownHeadingIdResolver {
  const reservedHeadingIds = new Set(headingIds);
  const usedIdCounts = new Map<string, number>();
  let headingIndex = 0;

  return {
    resolveId(headingText) {
      const preparedHeadingId = headingIds[headingIndex];
      headingIndex += 1;

      if (preparedHeadingId != null) {
        return preparedHeadingId;
      }

      const comparableTitle = normalizeMarkdownHeadingTitle(headingText);
      const baseId = createMarkdownHeadingSlug(comparableTitle) ?? EMPTY_MARKDOWN_HEADING_ID;
      let headingId = createUniqueMarkdownHeadingId({ baseId, usedIdCounts });

      while (reservedHeadingIds.has(headingId)) {
        headingId = createUniqueMarkdownHeadingId({ baseId, usedIdCounts });
      }

      return headingId;
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
