import type { Locale } from '@/shared/i18n/i18n';
import type { PostSeries } from '../../model/post-index';
import { PostCard } from '../post-card/post-card';
import styles from './collection-view.module.css';

interface SeriesViewProps {
  locale?: Locale;
  series: PostSeries[];
}

export function SeriesView({ locale = 'ko', series }: SeriesViewProps) {
  const messages = SERIES_MESSAGES[locale];

  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Collections</p>
        <h1 className={styles.title}>Series</h1>
        <p className={styles.description}>{messages.description}</p>
      </header>

      {series.length > 0 ? (
        <div className={styles.seriesList}>
          {series.map(postSeries => (
            <section className={styles.seriesSection} id={postSeries.name} key={postSeries.name}>
              <header className={styles.seriesHeader}>
                <h2 className={styles.seriesTitle}>{postSeries.name}</h2>
                <p className={styles.seriesCount}>{messages.postCount(postSeries.posts.length)}</p>
              </header>
              <div className={styles.seriesPostList}>
                {postSeries.posts.map(post => (
                  <PostCard key={post.slug} locale={locale} post={post} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMessage}>{messages.empty}</p>
      )}
    </section>
  );
}

const SERIES_MESSAGES = {
  ko: {
    description: '연속된 주제의 글을 읽는 순서대로 모았습니다.',
    empty: '등록된 시리즈가 없습니다.',
    postCount: (count: number) => `${count}개 글`,
  },
} satisfies Record<Locale, SeriesMessages>;

interface SeriesMessages {
  description: string;
  empty: string;
  postCount: (count: number) => string;
}
