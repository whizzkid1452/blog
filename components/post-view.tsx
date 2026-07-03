import type { Post, PostSummary } from '@/lib/posts';
import Link from 'next/link';
import { MarkdownContent } from './markdown-content';
import styles from './post-view.module.css';

interface PostViewProps {
  post: Post;
  relatedPosts: PostSummary[];
}

export function PostView({ post, relatedPosts }: PostViewProps) {
  return (
    <div className={styles.pageShell}>
      <article className={styles.article}>
        <header className={styles.header}>
          <time className={styles.postDate} dateTime={post.date}>
            {post.date}
          </time>
          <h1 className={styles.title}>{post.title}</h1>
          {post.description == null ? null : <p className={styles.description}>{post.description}</p>}
          <div className={styles.tagList} aria-label="Tags">
            {post.tags.map(tag => (
              <Link key={tag} className={styles.tagLink} href={`/tags/${encodeURIComponent(tag)}`}>
                #{tag}
              </Link>
            ))}
          </div>
        </header>
        <MarkdownContent content={post.content} title={post.title} />
      </article>
      {relatedPosts.length > 0 ? (
        <section className={styles.relatedSection} aria-labelledby="related-posts-title">
          <h2 className={styles.relatedTitle} id="related-posts-title">
            Related posts
          </h2>
          <ul className={styles.relatedList}>
            {relatedPosts.map(relatedPost => (
              <li className={styles.relatedItem} key={relatedPost.slug}>
                <Link className={styles.relatedLink} href={`/posts/${relatedPost.slug}`}>
                  {relatedPost.title}
                </Link>
                <div className={styles.relatedMeta}>
                  <time dateTime={relatedPost.date}>{relatedPost.date}</time>
                  <span>{relatedPost.tags.map(tag => `#${tag}`).join(' ')}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
