import type { Locale } from '@/shared/i18n/i18n';
import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import type { ReactNode } from 'react';
import { SiteLayout } from './site-layout';

interface SiteLayoutContainerProps {
  children: ReactNode;
  locale: Locale;
}

export function SiteLayoutContainer({ children, locale }: SiteLayoutContainerProps) {
  const postIndex = getPostIndexForLocale(locale);
  const posts = postIndex.getPostSummaries();
  const tags = postIndex.getTags();

  return (
    <SiteLayout locale={locale} tags={tags} recentPosts={posts}>
      {children}
    </SiteLayout>
  );
}
