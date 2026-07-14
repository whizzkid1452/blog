import type { Locale } from '@/lib/i18n';
import { getPostIndexForLocale } from '@/lib/post-translations';
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
