import type { PostSummary } from '../../model/post';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getUiMessages } from '@/shared/i18n/i18n';
import Image from 'next/image';
import Link from 'next/link';
import styles from './post-card.module.css';

interface PostCardProps {
  locale?: Locale;
  post: PostSummary;
}

export function PostCard({ locale = 'ko', post }: PostCardProps) {
  const messages = getUiMessages(locale);
  const postPath = createLocalizedPath(locale, `/posts/${post.slug}`);
  const generatedPreviewImage = post.visibility === 'public' ? `${postPath}/preview-image` : '/og-default.svg';
  const previewImage = post.coverImage ?? generatedPreviewImage;

  return (
    <article className={styles.article}>
      <div className={styles.postContent}>
        <div className={styles.postMeta}>
          <time className={styles.postDate} dateTime={post.date}>
            {post.date}
          </time>
          {post.series == null ? null : (
            <Link
              className={styles.seriesLink}
              href={`${createLocalizedPath(locale, '/series')}#${encodeURIComponent(post.series.name)}`}
            >
              {post.series.name} {getSeriesOrderLabel(locale, post.series.order)}
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
        </div>
        <h2 className={styles.postTitle}>
          <Link className={styles.postLink} href={postPath}>
            {post.title}
          </Link>
        </h2>
        {post.description == null ? null : <p className={styles.postDescription}>{post.description}</p>}
      </div>
      <div className={styles.previewImageContainer}>
        <Image
          className={styles.previewImage}
          src={previewImage}
          alt={post.coverAlt ?? ''}
          width={1200}
          height={630}
          sizes="(max-width: 640px) calc(100vw - 40px), 220px"
        />
      </div>
    </article>
  );
}

function getSeriesOrderLabel(locale: Locale, order: number): string {
  return locale === 'ko' ? `${order}편` : `Part ${order}`;
}
