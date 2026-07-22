import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Post } from '../model/post';
import { createPostBreadcrumbJsonLd, createPostJsonLd, createSiteJsonLd } from './structured-data';

interface JsonLdGraph {
  '@graph': Array<Record<string, unknown>>;
}

interface BreadcrumbJsonLd {
  itemListElement: Array<{
    position: number;
    name: string;
    item: string;
  }>;
}

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
      inLanguage: string;
      isPartOf: {
        '@id': string;
      };
      author: {
        '@type': string;
        '@id': string;
        name: string;
        url: string;
      };
      publisher: {
        '@id': string;
      };
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
      inLanguage: 'ko-KR',
      isPartOf: {
        '@id': 'https://example.com/#website',
      },
      author: {
        '@type': 'Person',
        '@id': 'https://example.com/#person',
        name: 'whizzkid1452',
        url: 'https://github.com/whizzkid1452',
      },
      keywords: ['nextjs', 'seo'],
    });
    expect(parsedJsonLd.publisher['@id']).toBe('https://example.com/#person');
  });
});

describe('createSiteJsonLd', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates website and author graph data', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    const parsedJsonLd = JSON.parse(createSiteJsonLd()) as JsonLdGraph;

    expect(parsedJsonLd['@graph']).toEqual([
      {
        '@type': 'Person',
        '@id': 'https://example.com/#person',
        name: 'whizzkid1452',
        url: 'https://github.com/whizzkid1452',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://example.com/#website',
        name: '앨리스의 토끼굴',
        description:
          '빠르게 훑고 지나가기보다, 앨리스가 흰 토끼를 따라 토끼굴로 들어가듯 끝까지 파고드는 개발을 지향합니다.',
        url: 'https://example.com/',
        inLanguage: 'ko-KR',
        publisher: {
          '@id': 'https://example.com/#person',
        },
      },
    ]);
  });
});

describe('createPostBreadcrumbJsonLd', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates breadcrumb list data for a post page', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    const parsedJsonLd = JSON.parse(createPostBreadcrumbJsonLd(createPost())) as BreadcrumbJsonLd;

    expect(parsedJsonLd.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: '앨리스의 토끼굴',
        item: 'https://example.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Posts',
        item: 'https://example.com/posts',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: '<script>alert(1)</script>',
        item: 'https://example.com/posts/json-ld-escape',
      },
    ]);
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
    visibility: 'public',
    content: 'Post content',
  };
}
