export interface MarkdownTableOfContentsItem {
  id: string;
  title: string;
}

interface PrepareMarkdownContentParams {
  content: string;
  title?: string;
}

interface PreparedMarkdownContent {
  content: string;
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

interface CreateMarkdownHeadingIdResolverParams {
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

interface MarkdownHeadingIdResolver {
  resolveId: (headingText: string) => string;
}

interface CreateUniqueIdParams {
  baseId: string;
  usedIdCounts: Map<string, number>;
}

const TABLE_OF_CONTENTS_HEADING = '## 목차';
const ORDERED_LIST_ITEM_PATTERN = /^\d+\.\s+(.+?)\s*$/;
const LEADING_SECTION_NUMBER_PATTERN = /^\d+(?:-\d+)*\.\s*/;
const NON_SLUG_CHARACTER_PATTERN = /[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g;
const SLUG_SEPARATOR_PATTERN = /^-+|-+$/g;
const EMPTY_SECTION_ID = 'section';

export function prepareMarkdownContent({ content, title }: PrepareMarkdownContentParams): PreparedMarkdownContent {
  const contentWithoutDuplicateTitle = removeDuplicateTitle({ content, title });

  return extractTableOfContents(contentWithoutDuplicateTitle);
}

export function createMarkdownHeadingIdResolver({
  tableOfContentsItems,
}: CreateMarkdownHeadingIdResolverParams): MarkdownHeadingIdResolver {
  const idByComparableTitle = new Map(
    tableOfContentsItems.map(item => [normalizeHeadingTitle(item.title), item.id] as const)
  );
  const usedIdCounts = new Map<string, number>();

  return {
    resolveId(headingText) {
      const comparableTitle = normalizeHeadingTitle(headingText);
      const baseId = idByComparableTitle.get(comparableTitle) ?? createSlug(comparableTitle) ?? EMPTY_SECTION_ID;

      return createUniqueId({ baseId, usedIdCounts });
    },
  };
}

function removeDuplicateTitle({ content, title }: PrepareMarkdownContentParams): string {
  if (title == null) {
    return content;
  }

  const trimmedTitle = title.trim();
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim();

  if (firstLine !== `# ${trimmedTitle}`) {
    return content;
  }

  return lines.slice(1).join('\n').trimStart();
}

function extractTableOfContents(content: string): PreparedMarkdownContent {
  const lines = content.split('\n');
  const headingIndex = lines.findIndex(line => line.trim() === TABLE_OF_CONTENTS_HEADING);

  if (headingIndex === -1) {
    return { content, tableOfContentsItems: [] };
  }

  const listStartIndex = findNextContentLineIndex({ lines, startIndex: headingIndex + 1 });

  if (listStartIndex == null) {
    return { content, tableOfContentsItems: [] };
  }

  const collectedList = collectOrderedListItems({ lines, startIndex: listStartIndex });

  if (collectedList.titles.length === 0) {
    return { content, tableOfContentsItems: [] };
  }

  const contentWithoutTableOfContents = [...lines.slice(0, headingIndex), ...lines.slice(collectedList.endIndex)]
    .join('\n')
    .trimStart();

  return {
    content: contentWithoutTableOfContents,
    tableOfContentsItems: createTableOfContentsItems(collectedList.titles),
  };
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
    const trimmedLine = lines[currentIndex]?.trim() ?? '';
    const itemMatch = ORDERED_LIST_ITEM_PATTERN.exec(trimmedLine);

    if (itemMatch == null) {
      break;
    }

    titles.push(itemMatch[1]);
    currentIndex += 1;
  }

  return {
    endIndex: currentIndex,
    titles,
  };
}

function createTableOfContentsItems(titles: string[]): MarkdownTableOfContentsItem[] {
  const usedIdCounts = new Map<string, number>();

  return titles.map((title, index) => {
    const fallbackId = `${EMPTY_SECTION_ID}-${index + 1}`;
    const baseId = createSlug(title) ?? fallbackId;

    return {
      id: createUniqueId({ baseId, usedIdCounts }),
      title,
    };
  });
}

function normalizeHeadingTitle(headingText: string): string {
  return headingText.trim().replace(LEADING_SECTION_NUMBER_PATTERN, '').trim();
}

function createSlug(text: string): string | null {
  const slug = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(NON_SLUG_CHARACTER_PATTERN, '-')
    .replace(SLUG_SEPARATOR_PATTERN, '');

  if (slug === '') {
    return null;
  }

  return slug;
}

function createUniqueId({ baseId, usedIdCounts }: CreateUniqueIdParams): string {
  const usedCount = usedIdCounts.get(baseId) ?? 0;
  usedIdCounts.set(baseId, usedCount + 1);

  if (usedCount === 0) {
    return baseId;
  }

  return `${baseId}-${usedCount + 1}`;
}
