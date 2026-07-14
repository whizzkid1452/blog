'use client';

import type { PostSummary } from '@/lib/posts';
import { searchPostSummaries } from '@/lib/post-search';
import { useDeferredValue, useState } from 'react';
import styles from './collection-view.module.css';
import { PostCard } from './post-card';

interface PostSearchViewProps {
  posts: PostSummary[];
}

export function PostSearchView({ posts }: PostSearchViewProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchResults = searchPostSummaries({ posts, query: deferredQuery });
  const resultLabel =
    deferredQuery.trim().length === 0 ? `전체 ${posts.length}개` : `검색 결과 ${searchResults.length}개`;

  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Archive</p>
        <h1 className={styles.title}>Search</h1>
        <p className={styles.description}>제목, 설명, 태그, 시리즈명에서 글을 검색합니다.</p>
      </header>

      <div className={styles.searchArea} role="search">
        <label className={styles.searchLabel} htmlFor="post-search-input">
          검색어
        </label>
        <div className={styles.searchControl}>
          <input
            id="post-search-input"
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="제목, 태그, 시리즈 검색"
            autoComplete="off"
          />
          {query.length > 0 ? (
            <button className={styles.clearButton} type="button" onClick={() => setQuery('')}>
              지우기
            </button>
          ) : null}
        </div>
        <p className={styles.resultCount} aria-live="polite">
          {resultLabel}
        </p>
      </div>

      {searchResults.length > 0 ? (
        <section className={styles.postList} aria-label="검색 결과">
          {searchResults.map(post => (
            <PostCard key={post.slug} post={post} />
          ))}
        </section>
      ) : (
        <p className={styles.emptyMessage}>검색어와 일치하는 글이 없습니다.</p>
      )}
    </section>
  );
}
