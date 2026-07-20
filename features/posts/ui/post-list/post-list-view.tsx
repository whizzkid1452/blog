import type { Locale } from '@/shared/i18n/i18n';
import { SITE_NAME } from '@/shared/config/site-config';
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
  eyebrow,
  title = SITE_NAME,
  description = '빠르게 훑고 지나가기보다, 앨리스가 흰 토끼를 따라 토끼굴로 들어가듯 끝까지 파고드는 개발을 지향합니다.',
  emptyMessage = 'No posts published yet.',
  headerActions,
}: PostListViewProps) {
  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
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
