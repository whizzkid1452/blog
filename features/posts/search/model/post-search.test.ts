import { describe, expect, it } from 'vitest';
import { searchPostSummaries } from './post-search';
import type { PostSummary } from '../../model/post';

describe('searchPostSummaries', () => {
  const posts: PostSummary[] = [
    createPostSummary({
      slug: 'react-performance',
      title: 'React 렌더링 최적화',
      description: '프레임 단위 업데이트를 설명합니다.',
      tags: ['React', 'performance'],
      series: { name: '드래그 최적화', order: 1 },
    }),
    createPostSummary({
      slug: 'thumbnail-worker',
      title: 'Web Worker로 썸네일 만들기',
      description: '비디오 처리 과정을 설명합니다.',
      tags: ['thumbnail'],
      series: { name: '썸네일 생성', order: 1 },
    }),
  ];

  it('matches title, description, tag, and series name without case sensitivity', () => {
    expect(searchPostSummaries({ posts, query: 'react' }).map(post => post.slug)).toEqual(['react-performance']);
    expect(searchPostSummaries({ posts, query: '비디오' }).map(post => post.slug)).toEqual(['thumbnail-worker']);
    expect(searchPostSummaries({ posts, query: 'PERFORMANCE' }).map(post => post.slug)).toEqual(['react-performance']);
    expect(searchPostSummaries({ posts, query: '드래그' }).map(post => post.slug)).toEqual(['react-performance']);
  });

  it('returns all posts when the trimmed query is empty', () => {
    expect(searchPostSummaries({ posts, query: '   ' })).toEqual(posts);
  });
});

function createPostSummary(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    slug: 'post',
    title: 'Post title',
    description: 'Post description',
    date: '2026-07-01',
    tags: ['nextjs'],
    visibility: 'public',
    ...overrides,
  };
}
