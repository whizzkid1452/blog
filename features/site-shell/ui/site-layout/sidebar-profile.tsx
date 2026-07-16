import { SITE_AUTHOR_NAME } from '@/shared/config/site-config';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import Link from 'next/link';
import styles from './site-layout.module.css';

interface SidebarProfileProps {
  locale: Locale;
}

const SIDEBAR_PROFILE_TITLE = 'Whizzkid Blog';

export function SidebarProfile({ locale }: SidebarProfileProps) {
  return (
    <section className={styles.sidebarProfile} aria-label={SIDEBAR_PROFILE_TITLE}>
      <Link
        className={styles.sidebarProfileLink}
        href={createLocalizedPath(locale, '/')}
        aria-label={`${SIDEBAR_PROFILE_TITLE} home`}
      >
        <span className={styles.sidebarProfileMark} aria-hidden="true">
          {'</>'}
        </span>
        <p className={styles.sidebarProfileTitle}>{SIDEBAR_PROFILE_TITLE}</p>
        <p className={styles.sidebarProfileAuthor}>@{SITE_AUTHOR_NAME}</p>
      </Link>
    </section>
  );
}
