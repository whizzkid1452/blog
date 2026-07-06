import { getPostIndex } from '@/lib/posts';
import type { ReactNode } from 'react';
import { SiteLayout } from './site-layout';

interface SiteLayoutContainerProps {
  children: ReactNode;
}

export function SiteLayoutContainer({ children }: SiteLayoutContainerProps) {
  const postIndex = getPostIndex();
  const posts = postIndex.getPostSummaries();
  const tags = postIndex.getTags();

  return (
    <SiteLayout tags={tags} recentPosts={posts}>
      {children}
    </SiteLayout>
  );
}
