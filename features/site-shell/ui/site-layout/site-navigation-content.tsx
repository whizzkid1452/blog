import type { PostSummary } from '@/features/posts/model/post';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getAlternateLocale, getUiMessages } from '@/shared/i18n/i18n';
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
  const alternateLocale = getAlternateLocale(locale);

  return (
    <>
      <SidebarProfile locale={locale} />

      <nav className={styles.sidebarNavigation} aria-label={messages.primaryNavigationLabel}>
        <h2 className={styles.sidebarTitle}>{messages.blogNavigationLabel}</h2>

        <div className={styles.sidebarUtilityLinks}>
          <a
            className={styles.externalNavigationAnchor}
            href={githubProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile"
          >
            GitHub
          </a>
          <a
            className={styles.externalNavigationAnchor}
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="About"
          >
            About
          </a>
          <Link
            className={styles.externalNavigationAnchor}
            href={createLocalizedPath(alternateLocale, '/')}
            hrefLang={alternateLocale}
          >
            {messages.languageLinkLabel}
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
