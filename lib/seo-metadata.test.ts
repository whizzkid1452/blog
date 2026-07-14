import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPostPageMetadata } from './seo-metadata';
import type { Post } from './posts';

describe('createPostPageMetadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates canonical article metadata with the post Open Graph image fallback', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    const metadata = createPostPageMetadata(createPost());
    const openGraph = metadata.openGraph as {
      type: string;
      url: string;
      publishedTime: string;
      images: Array<{
        url: string;
        width: number;
        height: number;
        alt: string;
      }>;
      tags: string[];
    };

    expect(metadata.alternates?.canonical).toBe('https://example.com/posts/nextjs-static-output');
    expect(openGraph).toMatchObject({
      type: 'article',
      url: 'https://example.com/posts/nextjs-static-output',
      publishedTime: '2026-07-06T09:30:00.000Z',
      tags: ['nextjs', 'seo'],
    });
    expect(openGraph.images).toEqual([
      {
        url: 'https://example.com/posts/nextjs-static-output/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Next.js static output',
      },
    ]);
  });

  it('creates English canonical and language alternate metadata', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    const metadata = createPostPageMetadata(createPost(), { locale: 'en', hasAlternateLocale: true });

    expect(metadata.alternates).toEqual({
      canonical: 'https://example.com/en/posts/nextjs-static-output',
      languages: {
        'ko-KR': 'https://example.com/posts/nextjs-static-output',
        'en-US': 'https://example.com/en/posts/nextjs-static-output',
      },
    });
  });
});

function createPost(): Post {
  return {
    slug: 'nextjs-static-output',
    title: 'Next.js static output',
    description: 'Post description',
    date: '2026-07-06',
    publishedAt: '2026-07-06T09:30:00.000Z',
    tags: ['nextjs', 'seo'],
    draft: false,
    content: 'Post content',
  };
}
