export interface MarkdownTableOfContentsItem {
  headingTitle?: string;
  id: string;
  level: 2 | 3;
  title: string;
}

interface MarkdownHeading {
  level: 2 | 3;
  title: string;
}

interface SelectedMarkdownHeading extends MarkdownHeading {
  headingTitle?: string;
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
const MARKDOWN_HEADING_PATTERN = /^(#{2,3})\s+(.+?)\s*$/;
const LEADING_SECTION_NUMBER_PATTERN = /^\d+(?:-\d+)*\.\s*/;
const NON_SLUG_CHARACTER_PATTERN = /[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g;
const SLUG_SEPARATOR_PATTERN = /^-+|-+$/g;
const EMPTY_SECTION_ID = 'section';

export function hasMarkdownTableOfContents(content: string): boolean {
  return content.split('\n').some(line => line.trim() === TABLE_OF_CONTENTS_HEADING);
}

export function prepareMarkdownContent({ content, title }: PrepareMarkdownContentParams): PreparedMarkdownContent {
  const contentWithoutDuplicateTitle = removeDuplicateTitle({ content, title });

  return extractTableOfContents(contentWithoutDuplicateTitle);
}

export function createMarkdownHeadingIdResolver({
  tableOfContentsItems,
}: CreateMarkdownHeadingIdResolverParams): MarkdownHeadingIdResolver {
  const idByComparableTitle = new Map(
    tableOfContentsItems.map(item => [normalizeHeadingTitle(item.headingTitle ?? item.title), item.id] as const)
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

function collectMarkdownHeadings(lines: string[]): MarkdownHeading[] {
  return lines.flatMap(line => {
    const headingMatch = MARKDOWN_HEADING_PATTERN.exec(line.trim());

    if (headingMatch == null) {
      return [];
    }

    return [
      {
        level: headingMatch[1].length as MarkdownHeading['level'],
        title: headingMatch[2],
      },
    ];
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
      ? titles.map((title, headingIndex) => selectMarkdownHeading({ headingIndex, headings, title }))
      : headings;

  return selectedHeadings.map((heading, headingIndex) =>
    createTableOfContentsItem({ heading, headingIndex, usedIdCounts })
  );
}

function selectMarkdownHeading({
  headingIndex,
  headings,
  title,
}: {
  headingIndex: number;
  headings: MarkdownHeading[];
  title: string;
}): SelectedMarkdownHeading {
  const matchingHeading = findMarkdownHeading({ headings, title }) ?? headings[headingIndex];

  if (matchingHeading == null) {
    return { level: 2, title };
  }

  if (normalizeHeadingTitle(matchingHeading.title) === normalizeHeadingTitle(title)) {
    return { level: matchingHeading.level, title };
  }

  return {
    headingTitle: matchingHeading.title,
    level: matchingHeading.level,
    title,
  };
}

function createTableOfContentsItem({
  heading,
  headingIndex,
  usedIdCounts,
}: {
  heading: SelectedMarkdownHeading;
  headingIndex: number;
  usedIdCounts: Map<string, number>;
}): MarkdownTableOfContentsItem {
  const fallbackId = `${EMPTY_SECTION_ID}-${headingIndex + 1}`;
  const sourceTitle = heading.headingTitle ?? heading.title;
  const baseId = createSlug(normalizeHeadingTitle(sourceTitle)) ?? fallbackId;
  const item = {
    id: createUniqueId({ baseId, usedIdCounts }),
    level: heading.level,
    title: heading.title,
  };

  return heading.headingTitle == null ? item : { ...item, headingTitle: heading.headingTitle };
}

function findMarkdownHeading({
  headings,
  title,
}: {
  headings: MarkdownHeading[];
  title: string;
}): MarkdownHeading | undefined {
  const comparableTitle = normalizeHeadingTitle(title);

  return headings.find(heading => normalizeHeadingTitle(heading.title) === comparableTitle);
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
