import type { Locale } from '@/shared/i18n/i18n';
import type { PostSummary } from '../../model/post';
import { searchPostSummaries } from '../../search/model/post-search';
import { PostCard } from '../post-card/post-card';
import styles from './collection-view.module.css';

interface PostSearchViewProps {
  locale?: Locale;
  posts: PostSummary[];
  query: string;
}

export function PostSearchView({ locale = 'ko', posts, query }: PostSearchViewProps) {
  const searchResults = searchPostSummaries({ posts, query });
  const messages = SEARCH_MESSAGES[locale];
  const resultLabel =
    query.trim().length === 0 ? messages.totalCount(posts.length) : messages.resultCount(searchResults.length);

  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Archive</p>
        <h1 className={styles.title}>Search</h1>
        <p className={styles.description}>{messages.description}</p>
      </header>

      <p className={styles.resultCount} aria-live="polite">
        {resultLabel}
      </p>

      {searchResults.length > 0 ? (
        <section className={styles.postList} aria-label={messages.resultsLabel}>
          {searchResults.map(post => (
            <PostCard key={post.slug} locale={locale} post={post} />
          ))}
        </section>
      ) : (
        <p className={styles.emptyMessage}>{messages.empty}</p>
      )}
    </section>
  );
}

const SEARCH_MESSAGES = {
  ko: {
    description: '제목, 설명, 태그, 시리즈명에서 글을 검색합니다.',
    resultsLabel: '검색 결과',
    empty: '검색어와 일치하는 글이 없습니다.',
    totalCount: (count: number) => `전체 ${count}개`,
    resultCount: (count: number) => `검색 결과 ${count}개`,
  },
} satisfies Record<Locale, SearchMessages>;

interface SearchMessages {
  description: string;
  resultsLabel: string;
  empty: string;
  totalCount: (count: number) => string;
  resultCount: (count: number) => string;
}
