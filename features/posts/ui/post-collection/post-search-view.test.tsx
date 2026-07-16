import type { PostSummary } from '../../model/post';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PostSearchView } from './post-search-view';

const posts: PostSummary[] = [
  {
    slug: 'react-performance',
    title: 'React rendering performance',
    description: '렌더링 경로를 최적화합니다.',
    date: '2026-07-10',
    tags: ['react'],
  },
  {
    slug: 'thumbnail-worker',
    title: 'Web Worker thumbnail pipeline',
    description: '메인 스레드 밖에서 썸네일을 생성합니다.',
    date: '2026-07-09',
    tags: ['web-worker'],
  },
];

describe('PostSearchView', () => {
  it('renders only posts matching the query supplied by the search page', () => {
    const markup = renderToStaticMarkup(<PostSearchView posts={posts} query="react" />);

    expect(markup).toContain('React rendering performance');
    expect(markup).not.toContain('Web Worker thumbnail pipeline');
    expect(markup).toContain('검색 결과 1개');
  });

  it('does not duplicate the search input in the result content', () => {
    const markup = renderToStaticMarkup(<PostSearchView posts={posts} query="" />);

    expect(markup).not.toContain('type="search"');
    expect(markup).not.toContain('id="post-search-input"');
  });
});
