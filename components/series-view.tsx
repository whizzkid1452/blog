import type { PostSeries } from '@/lib/post-index';
import styles from './collection-view.module.css';
import { PostCard } from './post-card';

interface SeriesViewProps {
  series: PostSeries[];
}

export function SeriesView({ series }: SeriesViewProps) {
  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Collections</p>
        <h1 className={styles.title}>Series</h1>
        <p className={styles.description}>연속된 주제의 글을 읽는 순서대로 모았습니다.</p>
      </header>

      {series.length > 0 ? (
        <div className={styles.seriesList}>
          {series.map(postSeries => (
            <section className={styles.seriesSection} id={postSeries.name} key={postSeries.name}>
              <header className={styles.seriesHeader}>
                <h2 className={styles.seriesTitle}>{postSeries.name}</h2>
                <p className={styles.seriesCount}>{postSeries.posts.length}개 글</p>
              </header>
              <div className={styles.postList}>
                {postSeries.posts.map(post => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMessage}>등록된 시리즈가 없습니다.</p>
      )}
    </section>
  );
}
