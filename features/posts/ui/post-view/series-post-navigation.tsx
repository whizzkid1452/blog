import type { PostSeriesNavigation as PostSeriesNavigationData } from '../../model/post-index';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import Link from 'next/link';
import styles from './series-post-navigation.module.css';

interface SeriesPostNavigationProps {
  locale?: Locale;
  navigation: PostSeriesNavigationData;
}

export function SeriesPostNavigation({ locale = 'ko', navigation }: SeriesPostNavigationProps) {
  const messages = SERIES_NAVIGATION_MESSAGES[locale];
  const seriesPath = `${createLocalizedPath(locale, '/series')}#${encodeURIComponent(navigation.name)}`;

  return (
    <section className={styles.section} aria-labelledby="series-navigation-title">
      <Link className={styles.seriesLink} href={seriesPath}>
        <span className={styles.seriesLinkLabel}>{messages.seriesShortcut}</span>
        <strong className={styles.seriesName} id="series-navigation-title">
          {navigation.name}
        </strong>
      </Link>
      <nav className={styles.postNavigation} aria-label={messages.postNavigationLabel(navigation.name)}>
        {navigation.previousPost == null ? null : (
          <Link
            className={`${styles.postLink} ${styles.previousPostLink}`}
            href={createLocalizedPath(locale, `/posts/${navigation.previousPost.slug}`)}
          >
            <span className={styles.postLinkLabel}>{messages.previousPost}</span>
            <strong className={styles.postTitle}>{navigation.previousPost.title}</strong>
          </Link>
        )}
        {navigation.nextPost == null ? null : (
          <Link
            className={`${styles.postLink} ${styles.nextPostLink}`}
            href={createLocalizedPath(locale, `/posts/${navigation.nextPost.slug}`)}
          >
            <span className={styles.postLinkLabel}>{messages.nextPost}</span>
            <strong className={styles.postTitle}>{navigation.nextPost.title}</strong>
          </Link>
        )}
      </nav>
    </section>
  );
}

const SERIES_NAVIGATION_MESSAGES = {
  ko: {
    seriesShortcut: '시리즈 바로가기',
    previousPost: '← 이전 글',
    nextPost: '다음 글 →',
    postNavigationLabel: (seriesName: string) => `${seriesName} 시리즈 글 이동`,
  },
} satisfies Record<Locale, SeriesNavigationMessages>;

interface SeriesNavigationMessages {
  seriesShortcut: string;
  previousPost: string;
  nextPost: string;
  postNavigationLabel: (seriesName: string) => string;
}
