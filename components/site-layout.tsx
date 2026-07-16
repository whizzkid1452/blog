import type { PostSummary } from '@/lib/posts';
import type { Locale } from '@/lib/i18n';
import { createLocalizedPath, getAlternateLocale, getUiMessages } from '@/lib/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MobileNavigationDialog } from './mobile-navigation-dialog';
import { PrimaryNavigationLink } from './primary-navigation-link';
import { SidebarSearchForm } from './sidebar-search-form';
import { SidebarTopicsSection } from './sidebar-topics-section';
import styles from './site-layout.module.css';

interface SiteLayoutProps {
  children: ReactNode;
  locale: Locale;
  tags: string[];
  recentPosts: PostSummary[];
}

interface NavigationLink {
  href: string;
  label: string;
}

const GITHUB_PROFILE_URL = 'https://github.com/whizzkid1452';
const RESUME_URL = 'https://elderly-mosquito-87f.notion.site/38073b56612a80efb6e1f5f7055e5c15?source=copy_link';
const RECENT_POST_COUNT = 5;

export function SiteLayout({ children, locale, tags, recentPosts }: SiteLayoutProps) {
  const messages = getUiMessages(locale);
  const alternateLocale = getAlternateLocale(locale);
  const primaryNavigationLinks: NavigationLink[] = [
    { href: createLocalizedPath(locale, '/'), label: messages.home },
    { href: createLocalizedPath(locale, '/posts'), label: messages.posts },
    { href: createLocalizedPath(locale, '/series'), label: 'Series' },
    { href: createLocalizedPath(locale, '/private-posts'), label: locale === 'ko' ? '비공개 글' : 'Private posts' },
  ];
  const visibleRecentPosts = recentPosts.slice(0, RECENT_POST_COUNT);

  return (
    <div className={styles.siteShell}>
      <div className={styles.bodyLayout}>
        <aside className={styles.sidebar} aria-label={messages.blogNavigationLabel}>
          <nav className={styles.sidebarNavigation} aria-label={messages.primaryNavigationLabel}>
            <Link className={styles.brandLink} href={createLocalizedPath(locale, '/')}>
              Blog
            </Link>

            <div className={styles.sidebarNavigationLinks}>
              {primaryNavigationLinks.map(link => (
                <PrimaryNavigationLink key={link.href} href={link.href} label={link.label} />
              ))}
            </div>

            <div className={styles.sidebarUtilityLinks}>
              <a
                className={styles.externalNavigationAnchor}
                href={GITHUB_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub profile"
              >
                GitHub
              </a>
              <a
                className={styles.externalNavigationAnchor}
                href={RESUME_URL}
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
            {visibleRecentPosts.length > 0 ? (
              <ol className={styles.recentPostList}>
                {visibleRecentPosts.map(post => (
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
        </aside>

        <MobileNavigationDialog
          locale={locale}
          primaryNavigationLinks={primaryNavigationLinks}
          githubProfileUrl={GITHUB_PROFILE_URL}
          resumeUrl={RESUME_URL}
          tags={tags}
          recentPosts={visibleRecentPosts}
        />

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
