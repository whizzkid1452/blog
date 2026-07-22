import type { PostSummary } from '../../model/post';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getUiMessages } from '@/shared/i18n/i18n';
import Image from 'next/image';
import Link from 'next/link';
import styles from './post-card.module.css';

const POST_THUMBNAIL_SIZES = '(max-width: 640px) calc(100vw - 40px), 220px';

interface PostCardProps {
  locale?: Locale;
  post: PostSummary;
}

export function PostCard({ locale = 'ko', post }: PostCardProps) {
  const messages = getUiMessages(locale);
  const postPath = createLocalizedPath(locale, `/posts/${post.slug}`);

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
              {post.series.name} {getSeriesOrderLabel(post.series.order)}
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
      {post.thumbnail == null ? null : (
        <div className={styles.previewImageContainer}>
          <PostThumbnail src={post.thumbnail.src} alt={post.thumbnail.alt} />
        </div>
      )}
    </article>
  );
}

function PostThumbnail({ src, alt }: { src: string; alt: string }) {
  if (!isPublicRootPath(src)) {
    // 외부 이미지 호스트가 고정되어 있지 않아 Next.js 이미지 allowlist를 적용할 수 없다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.previewImage} src={src} alt={alt} width={1200} height={630} loading="lazy" />;
  }

  return (
    <Image className={styles.previewImage} src={src} alt={alt} width={1200} height={630} sizes={POST_THUMBNAIL_SIZES} />
  );
}

function isPublicRootPath(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//');
}

function getSeriesOrderLabel(order: number): string {
  return `${order}편`;
}
