import type { Locale } from '@/shared/i18n/i18n';
import type { PostSummary } from '../../model/post';
import type { ReactNode } from 'react';
import { PostCard } from '../post-card/post-card';
import styles from './post-list-view.module.css';

interface PostListViewProps {
  locale?: Locale;
  posts: PostSummary[];
  eyebrow?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  headerActions?: ReactNode;
}

export function PostListView({
  locale = 'ko',
  posts,
  eyebrow = 'Personal notes',
  title = 'Blog',
  description = 'Essays, engineering notes, and implementation logs.',
  emptyMessage = 'No posts published yet.',
  headerActions,
}: PostListViewProps) {
  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {headerActions}
      </header>

      {posts.length > 0 ? (
        <section className={styles.postList} aria-label="Posts">
          {posts.map(post => (
            <PostCard key={post.slug} locale={locale} post={post} />
          ))}
        </section>
      ) : (
        <p className={styles.emptyMessage}>{emptyMessage}</p>
      )}
    </section>
  );
}
