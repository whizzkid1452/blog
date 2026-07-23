import type { PostSummary } from '@/features/posts/model/post';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getUiMessages } from '@/shared/i18n/i18n';
import Link from 'next/link';
import { SidebarProfile } from './sidebar-profile';
import { SidebarSearchForm } from './sidebar-search-form';
import { SidebarTopicsSection } from './sidebar-topics-section';
import styles from './site-navigation-content.module.css';

interface SiteNavigationContentProps {
  locale: Locale;
  githubProfileUrl: string;
  resumeUrl: string;
  tags: string[];
  recentPosts: PostSummary[];
}

export function SiteNavigationContent({
  locale,
  githubProfileUrl,
  resumeUrl,
  tags,
  recentPosts,
}: SiteNavigationContentProps) {
  const messages = getUiMessages(locale);
  return (
    <>
      <SidebarProfile locale={locale} />

      <nav className={styles.sidebarNavigation} aria-label={messages.primaryNavigationLabel}>
        <h2 className={styles.sidebarTitle}>{messages.blogNavigationLabel}</h2>

        <div className={styles.sidebarUtilityLinks}>
          <a
            className={styles.navigationAnchor}
            href={githubProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile"
          >
            GitHub
          </a>
          <a
            className={styles.navigationAnchor}
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="About"
          >
            About
          </a>
          <Link
            className={styles.navigationAnchor}
            href={{ pathname: '/auth/login', query: { next: '/private-posts' } }}
          >
            Google 로그인
          </Link>
        </div>
      </nav>

      <SidebarSearchForm locale={locale} />

      <SidebarTopicsSection locale={locale} tags={tags} />

      <section className={styles.sidebarSection}>
        <h2 className={styles.sidebarTitle}>{messages.recent}</h2>
        {recentPosts.length > 0 ? (
          <ol className={styles.recentPostList}>
            {recentPosts.map(post => (
              <li className={styles.recentPostItem} key={post.slug}>
                <Link className={styles.recentPostLink} href={createLocalizedPath(locale, `/posts/${post.slug}`)}>
                  {post.title}
                </Link>
                <time className={styles.recentPostDate} dateTime={post.date}>
                  {post.date}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyText}>{messages.noPosts}</p>
        )}
      </section>
    </>
  );
}
