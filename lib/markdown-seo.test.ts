import { describe, expect, it } from 'vitest';
import { validateMarkdownSeo } from './markdown-seo';

const INTERNAL_ROUTES = new Set(['/', '/posts', '/posts/existing-post', '/tags/seo']);

describe('validateMarkdownSeo', () => {
  it('accepts images with alt text and links to generated routes', () => {
    expect(() =>
      validateMarkdownSeo({
        fileName: 'existing-post.md',
        content: '![Architecture diagram](/images/architecture.png)\n\nRead [the post](/posts/existing-post#intro).',
        internalRoutes: INTERNAL_ROUTES,
      })
    ).not.toThrow();
  });

  it('rejects images without alt text', () => {
    expect(() =>
      validateMarkdownSeo({
        fileName: 'missing-alt.md',
        content: '![](/images/architecture.png)',
        internalRoutes: INTERNAL_ROUTES,
      })
    ).toThrow('image "/images/architecture.png" requires alt text');
  });

  it('rejects local images that do not match a generated public asset', () => {
    expect(() =>
      validateMarkdownSeo({
        fileName: 'missing-image.md',
        content: '![Architecture diagram](/images/missing.png)',
        internalRoutes: INTERNAL_ROUTES,
        hasPublicImage: src => src !== '/images/missing.png',
      })
    ).toThrow('image "/images/missing.png" does not match a public asset');
  });

  it('rejects internal links that do not match generated routes', () => {
    expect(() =>
      validateMarkdownSeo({
        fileName: 'broken-link.md',
        content: 'Read [missing post](/posts/missing-post).',
        internalRoutes: INTERNAL_ROUTES,
      })
    ).toThrow('internal link "/posts/missing-post" does not match a generated route');
  });

  it('ignores external links, protocol-relative links, and fenced code blocks', () => {
    expect(() =>
      validateMarkdownSeo({
        fileName: 'external-links.md',
        content: [
          '[External](https://example.com)',
          '[CDN](//cdn.example.com/image.png)',
          '```md',
          '![](/images/example.png)',
          '[Missing](/posts/missing-post)',
          '```',
        ].join('\n'),
        internalRoutes: INTERNAL_ROUTES,
      })
    ).not.toThrow();
  });
});
