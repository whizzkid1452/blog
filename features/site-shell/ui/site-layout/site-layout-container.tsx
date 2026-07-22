import type { Locale } from '@/shared/i18n/i18n';
import { getPostIndex } from '@/features/posts/server/post-repository';
import type { ReactNode } from 'react';
import { SiteLayout } from './site-layout';

interface SiteLayoutContainerProps {
  children: ReactNode;
  locale: Locale;
}

export function SiteLayoutContainer({ children, locale }: SiteLayoutContainerProps) {
  const postIndex = getPostIndex();
  const posts = postIndex.getPostSummaries();
  const tags = postIndex.getTags();

  return (
    <SiteLayout locale={locale} tags={tags} recentPosts={posts}>
      {children}
    </SiteLayout>
  );
}
