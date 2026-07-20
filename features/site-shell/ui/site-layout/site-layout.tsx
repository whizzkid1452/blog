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
  recentPosts: PostSummary[];
}

const GITHUB_PROFILE_URL = 'https://github.com/whizzkid1452';
const RESUME_URL = 'https://elderly-mosquito-87f.notion.site/38073b56612a80efb6e1f5f7055e5c15?source=copy_link';
const RECENT_POST_COUNT = 5;

export function SiteLayout({ children, locale, tags, recentPosts }: SiteLayoutProps) {
  const messages = getUiMessages(locale);
  const visibleRecentPosts = recentPosts.slice(0, RECENT_POST_COUNT);

  return (
    <div className={styles.siteShell}>
      <div className={styles.bodyLayout}>
        <aside className={styles.sidebar} aria-label={messages.blogNavigationLabel}>
          <SiteNavigationContent
            locale={locale}
            githubProfileUrl={GITHUB_PROFILE_URL}
            resumeUrl={RESUME_URL}
            tags={tags}
            recentPosts={visibleRecentPosts}
          />
        </aside>

        <MobileNavigationDialog
          locale={locale}
          githubProfileUrl={GITHUB_PROFILE_URL}
          resumeUrl={RESUME_URL}
          tags={tags}
          posts={recentPosts}
          recentPosts={visibleRecentPosts}
        />

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
