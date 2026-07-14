'use client';

import type { Locale } from '@/lib/i18n';
import type { PostSummary } from '@/lib/posts';
import { searchPostSummaries } from '@/lib/post-search';
import { useDeferredValue, useState } from 'react';
import { PostCard } from './post-card';
import styles from './collection-view.module.css';

interface PostSearchViewProps {
  locale?: Locale;
  posts: PostSummary[];
}

export function PostSearchView({ locale = 'ko', posts }: PostSearchViewProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchResults = searchPostSummaries({ posts, query: deferredQuery });
  const messages = SEARCH_MESSAGES[locale];
  const resultLabel =
    deferredQuery.trim().length === 0 ? messages.totalCount(posts.length) : messages.resultCount(searchResults.length);

  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Archive</p>
        <h1 className={styles.title}>Search</h1>
        <p className={styles.description}>{messages.description}</p>
      </header>

      <div className={styles.searchArea} role="search">
        <label className={styles.searchLabel} htmlFor="post-search-input">
          {messages.label}
        </label>
        <div className={styles.searchControl}>
          <input
            id="post-search-input"
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={messages.placeholder}
            autoComplete="off"
          />
          {query.length > 0 ? (
            <button className={styles.clearButton} type="button" onClick={() => setQuery('')}>
              {messages.clear}
            </button>
          ) : null}
        </div>
        <p className={styles.resultCount} aria-live="polite">
          {resultLabel}
        </p>
      </div>

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
    label: '검색어',
    placeholder: '제목, 태그, 시리즈 검색',
    clear: '지우기',
    resultsLabel: '검색 결과',
    empty: '검색어와 일치하는 글이 없습니다.',
    totalCount: (count: number) => `전체 ${count}개`,
    resultCount: (count: number) => `검색 결과 ${count}개`,
  },
  en: {
    description: 'Search post titles, descriptions, tags, and series names.',
    label: 'Search term',
    placeholder: 'Search titles, tags, and series',
    clear: 'Clear',
    resultsLabel: 'Search results',
    empty: 'No posts match this search term.',
    totalCount: (count: number) => `${count} posts`,
    resultCount: (count: number) => `${count} results`,
  },
} satisfies Record<Locale, SearchMessages>;

interface SearchMessages {
  description: string;
  label: string;
  placeholder: string;
  clear: string;
  resultsLabel: string;
  empty: string;
  totalCount: (count: number) => string;
  resultCount: (count: number) => string;
}
