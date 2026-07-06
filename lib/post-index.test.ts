import { describe, expect, it } from 'vitest';
import { PostIndex, getPostPublishedDateTime } from './post-index';
import type { Post } from './posts';

describe('PostIndex', () => {
  it('returns only published post summaries ordered by publish time descending', () => {
    const index = new PostIndex([
      createPost({ slug: 'older-post', date: '2026-07-01' }),
      createPost({ slug: 'draft-post', date: '2026-07-04', draft: true }),
      createPost({ slug: 'newer-post', date: '2026-07-03', publishedAt: '2026-07-03T12:00:00.000Z' }),
    ]);

    expect(index.getPostSummaries().map(post => post.slug)).toEqual(['newer-post', 'older-post']);
  });

  it('does not expose draft posts through slug, tag, or tag list lookups', () => {
    const index = new PostIndex([
      createPost({ slug: 'published-post', tags: ['nextjs'] }),
      createPost({ slug: 'draft-post', tags: ['draft-only'], draft: true }),
    ]);

    expect(index.getPostBySlug('draft-post')).toBeNull();
    expect(index.getPostSummariesByTag('draft-only')).toEqual([]);
    expect(index.getTags()).toEqual(['nextjs']);
  });

  it('returns related posts by shared tag count, publish time, and slug', () => {
    const index = new PostIndex([
      createPost({ slug: 'current-post', date: '2026-07-05', tags: ['nextjs', 'seo'] }),
      createPost({ slug: 'same-tags-older', date: '2026-07-03', tags: ['nextjs', 'seo'] }),
      createPost({ slug: 'same-tags-newer', date: '2026-07-04', tags: ['nextjs', 'seo'] }),
      createPost({ slug: 'one-tag-newer', date: '2026-07-06', tags: ['nextjs'] }),
      createPost({ slug: 'one-tag-older', date: '2026-07-02', tags: ['seo'] }),
      createPost({ slug: 'unrelated-post', date: '2026-07-07', tags: ['deployment'] }),
    ]);

    expect(
      index.getRelatedPostSummaries({ slug: 'current-post', tags: ['nextjs', 'seo'] }).map(post => post.slug)
    ).toEqual(['same-tags-newer', 'same-tags-older', 'one-tag-newer']);
  });
});

describe('getPostPublishedDateTime', () => {
  it('uses the explicit publishedAt value when present', () => {
    expect(getPostPublishedDateTime(createPost({ date: '2026-07-01', publishedAt: '2026-07-01T09:00:00.000Z' }))).toBe(
      '2026-07-01T09:00:00.000Z'
    );
  });

  it('falls back to midnight UTC for date-only posts', () => {
    expect(getPostPublishedDateTime(createPost({ date: '2026-07-01' }))).toBe('2026-07-01T00:00:00.000Z');
  });
});

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    slug: 'post',
    title: 'Post title',
    description: 'Post description',
    date: '2026-07-01',
    tags: ['nextjs'],
    draft: false,
    content: 'Post content',
    ...overrides,
  };
}
