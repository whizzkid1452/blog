import type { PostSummary } from '@/lib/posts';
import Link from 'next/link';
import styles from './post-card.module.css';

interface PostCardProps {
  post: PostSummary;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className={styles.article}>
      <div className={styles.postMeta}>
        <time className={styles.postDate} dateTime={post.date}>
          {post.date}
        </time>
        <div className={styles.tagList} aria-label="Tags">
          {post.tags.map(tag => (
            <Link key={tag} className={styles.tagLink} href={`/tags/${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </div>
      </div>
      <h2 className={styles.postTitle}>
        <Link className={styles.postLink} href={`/posts/${post.slug}`}>
          {post.title}
        </Link>
      </h2>
      {post.description == null ? null : <p className={styles.postDescription}>{post.description}</p>}
    </article>
  );
}
