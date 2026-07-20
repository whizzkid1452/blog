export type MarkdownTableOfContentsDepth = 1 | 2 | 3;

export interface MarkdownTableOfContentsItem {
  depth: MarkdownTableOfContentsDepth;
  id: string;
  title: string;
}
