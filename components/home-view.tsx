import type { PostSummary } from '@/lib/posts';
import { PostCard } from './post-card';
import styles from './home-view.module.css';

interface HomeViewProps {
  posts: PostSummary[];
  eyebrow?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

export function HomeView({
  posts,
  eyebrow = 'Personal notes',
  title = 'Blog',
  description = 'Essays, engineering notes, and implementation logs.',
  emptyMessage = 'No posts published yet.',
}: HomeViewProps) {
  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </header>

      {posts.length > 0 ? (
        <section className={styles.postList} aria-label="Posts">
          {posts.map(post => (
            <PostCard key={post.slug} post={post} />
          ))}
        </section>
      ) : (
        <p className={styles.emptyMessage}>{emptyMessage}</p>
      )}
    </section>
  );
}
