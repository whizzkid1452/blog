import { SITE_AUTHOR_NAME, SITE_NAME } from '@/shared/config/site-config';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import Image from 'next/image';
import Link from 'next/link';
import styles from './site-layout.module.css';

interface SidebarProfileProps {
  locale: Locale;
}

export function SidebarProfile({ locale }: SidebarProfileProps) {
  return (
    <section className={styles.sidebarProfile} aria-label={SITE_NAME}>
      <Link
        className={styles.sidebarProfileLink}
        href={createLocalizedPath(locale, '/')}
        aria-label={`${SITE_NAME} home`}
      >
        <Image
          className={styles.sidebarProfileImage}
          src="/images/profile-avatar.png"
          alt=""
          width={112}
          height={112}
          priority
        />
        <p className={styles.sidebarProfileTitle}>{SITE_NAME}</p>
        <p className={styles.sidebarProfileAuthor}>@{SITE_AUTHOR_NAME}</p>
      </Link>
    </section>
  );
}
