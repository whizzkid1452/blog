import type { Locale } from '@/shared/i18n/i18n';
import { SITE_NAME } from '@/shared/config/site-config';
import { PixelIcon } from '@/shared/ui/pixel-icon/pixel-icon';
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
  headerVariant?: 'intro' | 'title' | 'none';
  emptyMessage?: string;
  headerActions?: ReactNode;
  beforePosts?: ReactNode;
}

export function PostListView({
  locale = 'ko',
  posts,
  eyebrow,
  title = SITE_NAME,
  description = '빠르게 훑고 지나가기보다, 앨리스가 흰 토끼를 따라 토끼굴로 들어가듯 끝까지 파고드는 개발을 지향합니다.',
  headerVariant = 'intro',
  emptyMessage = 'No posts published yet.',
  headerActions,
  beforePosts,
}: PostListViewProps) {
  return (
    <section className={styles.pageShell}>
      {headerVariant === 'intro' ? (
        <header className={styles.header}>
          <span className={styles.consoleLabel} aria-hidden="true">
            <PixelIcon name="gamepad" /> DEVELOPER&apos;S SAVE POINT
          </span>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>

          <div className={styles.consoleActions}>
            {posts.length > 0 && (
              <a className={styles.startLink} href="#post-archive">
                전체 글 읽기 <PixelIcon name="arrow" />
              </a>
            )}
            <span className={styles.postCount}>{posts.length} POSTS IN MEMORY</span>
          </div>
          {headerActions}
        </header>
      ) : headerVariant === 'title' ? (
        <h1 className={styles.title}>{title}</h1>
      ) : (
        <h1 className={styles.visuallyHidden}>{title}</h1>
      )}

      {beforePosts}

      {posts.length > 0 ? (
        <section id="post-archive" className={styles.postList} aria-label="Posts">
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
