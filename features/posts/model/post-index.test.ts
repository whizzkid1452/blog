import { describe, expect, it } from 'vitest';
import { PostIndex, getPostPublishedDateTime } from './post-index';
import type { Post } from './post';

describe('PostIndex', () => {
  it('returns only published post summaries ordered by publish time descending', () => {
    const index = new PostIndex([
      createPost({ slug: 'older-post', date: '2026-07-01' }),
      createPost({ slug: 'draft-post', date: '2026-07-04', draft: true }),
      createPost({ slug: 'newer-post', date: '2026-07-03', publishedAt: '2026-07-03T12:00:00.000Z' }),
    ]);

    expect(index.getPostSummaries().map(post => post.slug)).toEqual(['newer-post', 'older-post']);
  });

  it('returns only featured public posts in publish order', () => {
    const index = new PostIndex([
      createPost({ slug: 'older-featured', date: '2026-07-01', featured: true }),
      createPost({ slug: 'regular-post', date: '2026-07-04' }),
      createPost({ slug: 'featured-draft', date: '2026-07-05', featured: true, draft: true }),
      createPost({ slug: 'newer-featured', date: '2026-07-03', featured: true }),
    ]);

    expect(index.getFeaturedPostSummaries().map(post => post.slug)).toEqual(['newer-featured', 'older-featured']);
  });

  it('uses a configured cover image before content images', () => {
    const index = new PostIndex([
      createPost({
        coverImage: '/images/cover.png',
        coverAlt: 'Configured cover',
        content: '![Content image](/images/content.png)',
      }),
    ]);

    expect(index.getPostSummaries()[0]?.thumbnail).toEqual({
      src: '/images/cover.png',
      alt: 'Configured cover',
    });
  });

  it('uses the first content image as the thumbnail when a cover image is not configured', () => {
    const index = new PostIndex([createPost({ content: '![Content image](/images/content.png)' })]);

    expect(index.getPostSummaries()[0]?.thumbnail).toEqual({
      src: '/images/content.png',
      alt: 'Content image',
    });
  });

  it('omits the thumbnail when neither a cover image nor a content image exists', () => {
    const index = new PostIndex([createPost()]);

    expect(index.getPostSummaries()[0]?.thumbnail).toBeUndefined();
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

  it('does not expose authenticated posts through public lookups', () => {
    const index = new PostIndex([
      createPost({ slug: 'public-post' }),
      createPost({ slug: 'authenticated-post', visibility: 'authenticated' }),
    ]);

    expect(index.getPostSummaries().map(post => post.slug)).toEqual(['public-post']);
    expect(index.getPostBySlug('authenticated-post')).toBeNull();
  });

  it('returns private and draft posts only through authorized lookups', () => {
    const index = new PostIndex([
      createPost({ slug: 'public-post' }),
      createPost({ slug: 'authenticated-post', visibility: 'authenticated' }),
      createPost({ slug: 'authenticated-draft', visibility: 'authenticated', draft: true }),
      createPost({ slug: 'public-draft', draft: true }),
    ]);

    expect(index.getAuthorizedPostSummaries().map(post => post.slug)).toEqual([
      'authenticated-draft',
      'authenticated-post',
      'public-draft',
    ]);
    expect(index.getPostBySlugForAuthorizedViewer('authenticated-post')?.slug).toBe('authenticated-post');
    expect(index.getPostBySlugForAuthorizedViewer('authenticated-draft')?.slug).toBe('authenticated-draft');
    expect(index.getPostBySlugForAuthorizedViewer('public-draft')?.slug).toBe('public-draft');
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

  it('groups series alphabetically and orders each series by its explicit order', () => {
    const index = new PostIndex([
      createPost({ slug: 'series-b-second', series: { name: 'Series B', order: 2 } }),
      createPost({ slug: 'standalone-post' }),
      createPost({ slug: 'series-a-first', series: { name: 'Series A', order: 1 } }),
      createPost({ slug: 'series-b-first', series: { name: 'Series B', order: 1 } }),
      createPost({ slug: 'series-a-draft', draft: true, series: { name: 'Series A', order: 2 } }),
    ]);

    expect(
      index.getSeries().map(series => ({
        name: series.name,
        postSlugs: series.posts.map(post => post.slug),
      }))
    ).toEqual([
      { name: 'Series A', postSlugs: ['series-a-first'] },
      { name: 'Series B', postSlugs: ['series-b-first', 'series-b-second'] },
    ]);
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
    visibility: 'public',
    content: 'Post content',
    ...overrides,
  };
}
