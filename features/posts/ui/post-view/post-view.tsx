import type { Post, PostSummary } from '../../model/post';
import type { PostSeriesNavigation } from '../../model/post-index';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getUiMessages } from '@/shared/i18n/i18n';
import Link from 'next/link';
import { CommentsSection } from '@/features/comments/ui/comments-section/comments-section';
import { MarkdownContent } from './markdown/markdown-content';
import { hasMarkdownTableOfContents } from './markdown/markdown-table-of-contents';
import { SeriesPostNavigation } from './series-post-navigation';
import styles from './post-view.module.css';

interface PostViewProps {
  locale?: Locale;
  post: Post;
  relatedPosts: PostSummary[];
  seriesNavigation: PostSeriesNavigation | null;
}

export function PostView({ locale = 'ko', post, relatedPosts, seriesNavigation }: PostViewProps) {
  const messages = getUiMessages(locale);
  const hasTableOfContents = hasMarkdownTableOfContents(post.content);

  return (
    <div className={styles.pageShell} data-has-table-of-contents={hasTableOfContents || undefined}>
      <article className={styles.article}>
        <header className={styles.header}>
          <time className={styles.postDate} dateTime={post.date}>
            {post.date}
          </time>
          <h1 className={styles.title}>{post.title}</h1>
          {post.description == null ? null : <p className={styles.description}>{post.description}</p>}
          <div className={styles.tagList} aria-label={messages.tagsLabel}>
            {post.tags.map(tag => (
              <Link
                key={tag}
                className={styles.tagLink}
                href={createLocalizedPath(locale, `/tags/${encodeURIComponent(tag)}`)}
              >
                #{tag}
              </Link>
            ))}
          </div>
        </header>
        <MarkdownContent content={post.content} locale={locale} title={post.title} />
      </article>
      {seriesNavigation == null ? null : <SeriesPostNavigation locale={locale} navigation={seriesNavigation} />}
      {relatedPosts.length > 0 ? (
        <section className={styles.relatedSection} aria-labelledby="related-posts-title">
          <h2 className={styles.relatedTitle} id="related-posts-title">
            {messages.relatedPosts}
          </h2>
          <ul className={styles.relatedList}>
            {relatedPosts.map(relatedPost => (
              <li className={styles.relatedItem} key={relatedPost.slug}>
                <Link className={styles.relatedLink} href={createLocalizedPath(locale, `/posts/${relatedPost.slug}`)}>
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
      {post.visibility === 'public' ? <CommentsSection locale={locale} postSlug={post.slug} /> : null}
    </div>
  );
}
