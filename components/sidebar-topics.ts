const PRIMARY_SIDEBAR_TOPIC_TAGS = [
  'react',
  'architecture',
  'nextjs',
  'seo',
  'performance',
  'state-management',
  'zustand',
  'design-system',
  'canvas',
  'electron',
  'web-worker',
  'webcodecs',
] as const;

const SIDEBAR_TOPIC_LABELS: Partial<Record<string, string>> = {
  nextjs: 'Next.js',
  performance: '성능최적화',
  'state-management': '상태관리',
};

export function getCollapsedSidebarTopicTags(tags: string[]): string[] {
  const availableTagSet = new Set(tags);

  return PRIMARY_SIDEBAR_TOPIC_TAGS.filter(tag => availableTagSet.has(tag));
}

export function getExpandedSidebarTopicTags(tags: string[]): string[] {
  const collapsedTopicTags = getCollapsedSidebarTopicTags(tags);
  const collapsedTopicTagSet = new Set(collapsedTopicTags);
  const remainingTags = tags.filter(tag => !collapsedTopicTagSet.has(tag));

  return [...collapsedTopicTags, ...remainingTags];
}

export function getSidebarTopicLabel(tag: string): string {
  return SIDEBAR_TOPIC_LABELS[tag] ?? tag;
}
