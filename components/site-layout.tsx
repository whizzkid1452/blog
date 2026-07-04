import type { PostSummary } from '@/lib/posts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MobileNavigationDialog } from './mobile-navigation-dialog';
import { PrimaryNavigationLink } from './primary-navigation-link';
import { SidebarTopicsSection } from './sidebar-topics-section';
import styles from './site-layout.module.css';

interface SiteLayoutProps {
  children: ReactNode;
  tags: string[];
  recentPosts: PostSummary[];
}

interface NavigationLink {
  href: string;
  label: string;
}

const PRIMARY_NAVIGATION_LINKS: NavigationLink[] = [
  { href: '/', label: 'Home' },
  { href: '/posts', label: 'Posts' },
];

const GITHUB_PROFILE_URL = 'https://github.com/whizzkid1452';
const RESUME_URL = 'https://elderly-mosquito-87f.notion.site/38073b56612a80efb6e1f5f7055e5c15?source=copy_link';
const RECENT_POST_COUNT = 5;

export function SiteLayout({ children, tags, recentPosts }: SiteLayoutProps) {
  const visibleRecentPosts = recentPosts.slice(0, RECENT_POST_COUNT);

  return (
    <div className={styles.siteShell}>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <Link className={styles.brandLink} href="/">
            Blog
          </Link>
          <nav className={styles.primaryNavigation} aria-label="Primary navigation">
            {PRIMARY_NAVIGATION_LINKS.map(link => (
              <PrimaryNavigationLink key={link.href} href={link.href} label={link.label} />
            ))}
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
              aria-label="Resume"
            >
              Resume
            </a>
          </nav>
          <MobileNavigationDialog
            primaryNavigationLinks={PRIMARY_NAVIGATION_LINKS}
            githubProfileUrl={GITHUB_PROFILE_URL}
            resumeUrl={RESUME_URL}
            tags={tags}
            recentPosts={visibleRecentPosts}
          />
        </div>
      </header>

      <div className={styles.bodyLayout}>
        <aside className={styles.sidebar} aria-label="Blog navigation">
          <SidebarTopicsSection tags={tags} />

          <section className={styles.sidebarSection}>
            <h2 className={styles.sidebarTitle}>Recent</h2>
            {visibleRecentPosts.length > 0 ? (
              <ol className={styles.recentPostList}>
                {visibleRecentPosts.map(post => (
                  <li className={styles.recentPostItem} key={post.slug}>
                    <Link className={styles.recentPostLink} href={`/posts/${post.slug}`}>
                      {post.title}
                    </Link>
                    <time className={styles.recentPostDate} dateTime={post.date}>
                      {post.date}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyText}>No posts yet.</p>
            )}
          </section>
        </aside>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
