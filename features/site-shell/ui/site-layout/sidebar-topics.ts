const PRIMARY_SIDEBAR_TOPIC_TAGS = [
  'performance',
  'architecture',
  'react',
  'canvas',
  'web-worker',
  'electron',
] as const;

const SIDEBAR_TOPIC_LABELS: Partial<Record<string, string>> = {
  nextjs: 'Next.js',
  performance: '성능최적화',
  'state-management': '상태관리',
};

export function getPrimarySidebarTopicTags(tags: string[]): string[] {
  const availableTagSet = new Set(tags);

  return PRIMARY_SIDEBAR_TOPIC_TAGS.filter(tag => availableTagSet.has(tag));
}

export function getSidebarTopicLabel(tag: string): string {
  return SIDEBAR_TOPIC_LABELS[tag] ?? tag;
}
