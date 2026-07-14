import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSitemap } from './sitemap';

describe('createSitemap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates canonical static, post, and encoded tag routes', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    const routes = createSitemap({
      posts: [
        {
          slug: 'nextjs-static-output',
          title: 'Next.js static output',
          description: 'Post description',
          date: '2026-07-06',
          publishedAt: '2026-07-06T09:30:00.000Z',
          tags: ['nextjs'],
        },
      ],
      tags: ['next js'],
      englishPosts: [
        {
          slug: 'nextjs-static-output',
          title: 'Next.js static output',
          description: 'English post description',
          date: '2026-07-06',
          publishedAt: '2026-07-06T09:30:00.000Z',
          tags: ['nextjs'],
        },
      ],
      englishTags: ['nextjs'],
    });

    expect(routes).toContainEqual(
      expect.objectContaining({
        url: 'https://example.com/',
        changeFrequency: 'weekly',
        priority: 1,
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        url: 'https://example.com/posts/nextjs-static-output',
        lastModified: new Date('2026-07-06T09:30:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        url: 'https://example.com/tags/next%20js',
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        url: 'https://example.com/en/posts/nextjs-static-output',
        alternates: {
          languages: {
            'ko-KR': 'https://example.com/posts/nextjs-static-output',
            'en-US': 'https://example.com/en/posts/nextjs-static-output',
          },
        },
      })
    );
  });
});
