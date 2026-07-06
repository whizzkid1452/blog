import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPostJsonLd } from './structured-data';
import type { Post } from './posts';

describe('createPostJsonLd', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('escapes script-breaking characters while preserving JSON-LD values after parsing', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    const jsonLd = createPostJsonLd(createPost());
    const parsedJsonLd = JSON.parse(jsonLd) as {
      headline: string;
      datePublished: string;
      dateModified: string;
      image: string;
      url: string;
      keywords: string[];
    };

    expect(jsonLd).toContain('\\u003cscript>');
    expect(jsonLd).not.toContain('<script>');
    expect(parsedJsonLd).toMatchObject({
      headline: '<script>alert(1)</script>',
      datePublished: '2026-07-06T09:30:00.000Z',
      dateModified: '2026-07-06T09:30:00.000Z',
      image: 'https://example.com/posts/json-ld-escape/opengraph-image',
      url: 'https://example.com/posts/json-ld-escape',
      keywords: ['nextjs', 'seo'],
    });
  });
});

function createPost(): Post {
  return {
    slug: 'json-ld-escape',
    title: '<script>alert(1)</script>',
    description: 'Post description',
    date: '2026-07-06',
    publishedAt: '2026-07-06T09:30:00.000Z',
    tags: ['nextjs', 'seo'],
    draft: false,
    content: 'Post content',
  };
}
