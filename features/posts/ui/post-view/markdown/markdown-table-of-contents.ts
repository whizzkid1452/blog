import { createMarkdownHeadingIdResolver } from './markdown-heading-id';
import { extractMarkdownTableOfContents, hasMarkdownTableOfContents } from './markdown-table-of-contents-parser';

export { createMarkdownHeadingIdResolver, hasMarkdownTableOfContents };
export type { MarkdownTableOfContentsItem } from './markdown-table-of-contents-types';

interface PrepareMarkdownContentParams {
  content: string;
  title?: string;
}

export function prepareMarkdownContent({ content, title }: PrepareMarkdownContentParams) {
  return extractMarkdownTableOfContents(removeDuplicateTitle({ content, title }));
}

function removeDuplicateTitle({ content, title }: PrepareMarkdownContentParams): string {
  if (title == null) {
    return content;
  }

  const lines = content.split('\n');

  if (lines[0]?.trim() !== `# ${title.trim()}`) {
    return content;
  }

  return lines.slice(1).join('\n').trimStart();
}
