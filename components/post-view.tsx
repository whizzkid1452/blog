import type { Post, PostSummary } from '@/lib/posts';
import type { Locale } from '@/lib/i18n';
import { createLocalizedPath, getUiMessages } from '@/lib/i18n';
import Link from 'next/link';
import { CommentsSection } from './comments-section';
import { MarkdownContent } from './markdown-content';
import { hasMarkdownTableOfContents } from './markdown-table-of-contents';
import styles from './post-view.module.css';

interface PostViewProps {
  locale?: Locale;
  post: Post;
  relatedPosts: PostSummary[];
  translationHref?: string;
}

export function PostView({ locale = 'ko', post, relatedPosts, translationHref }: PostViewProps) {
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
          {translationHref == null ? null : (
            <Link className={styles.translationLink} href={translationHref} hrefLang={locale === 'ko' ? 'en' : 'ko'}>
              {messages.languageLinkLabel}
            </Link>
          )}
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
        <MarkdownContent content={post.content} postSlug={post.slug} title={post.title} />
      </article>
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
