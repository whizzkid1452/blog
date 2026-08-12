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
}

export function SiteNavigationContent({ locale, githubProfileUrl, resumeUrl, tags }: SiteNavigationContentProps) {
  const messages = getUiMessages(locale);
  return (
    <>
      <SidebarProfile locale={locale} />

      <nav className={styles.sidebarNavigation} aria-label={messages.primaryNavigationLabel}>
        <h2 className={styles.sidebarTitle}>{messages.blogNavigationLabel}</h2>

        <div className={styles.sidebarUtilityLinks}>
          <Link className={styles.navigationAnchor} href={createLocalizedPath(locale, '/posts')}>
            {messages.posts}
          </Link>
          <Link className={styles.navigationAnchor} href={createLocalizedPath(locale, '/series')}>
            {messages.series}
          </Link>
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
        </div>
      </nav>

      <SidebarSearchForm locale={locale} />

      <SidebarTopicsSection locale={locale} tags={tags} />
    </>
  );
}
