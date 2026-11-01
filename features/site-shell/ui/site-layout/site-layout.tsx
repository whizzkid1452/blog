import type { PostSummary } from '@/features/posts/model/post';
import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';
import type { ReactNode } from 'react';
import { MobileNavigationDialog } from './mobile-navigation-dialog';
import { SiteNavigationContent } from './site-navigation-content';
import styles from './site-layout.module.css';

interface SiteLayoutProps {
  children: ReactNode;
  locale: Locale;
  tags: string[];
  posts: PostSummary[];
}

const GITHUB_PROFILE_URL = 'https://github.com/whizzkid1452';
const RESUME_URL = 'https://app.notion.com/p/Frontend-Developer-3e473b56612a817da9d4f8ec18e9e537';
export function SiteLayout({ children, locale, tags, posts }: SiteLayoutProps) {
  const messages = getUiMessages(locale);

  return (
    <div className={styles.siteShell}>
      <div className={styles.bodyLayout}>
        <aside className={styles.sidebar} aria-label={messages.blogNavigationLabel}>
          <SiteNavigationContent
            locale={locale}
            githubProfileUrl={GITHUB_PROFILE_URL}
            resumeUrl={RESUME_URL}
            tags={tags}
          />
        </aside>

        <MobileNavigationDialog
          locale={locale}
          githubProfileUrl={GITHUB_PROFILE_URL}
          resumeUrl={RESUME_URL}
          tags={tags}
          posts={posts}
        />

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
