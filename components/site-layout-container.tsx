import { getPostSummaries, getTags } from '@/lib/posts';
import type { ReactNode } from 'react';
import { SiteLayout } from './site-layout';

interface SiteLayoutContainerProps {
  children: ReactNode;
}

export function SiteLayoutContainer({ children }: SiteLayoutContainerProps) {
  const posts = getPostSummaries();
  const tags = getTags();

  return (
    <SiteLayout tags={tags} recentPosts={posts}>
      {children}
    </SiteLayout>
  );
}
