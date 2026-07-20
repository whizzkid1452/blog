import { describe, expect, it } from 'vitest';
import { createMarkdownHeadingIdResolver } from './markdown-heading-id';

describe('createMarkdownHeadingIdResolver', () => {
  it('uses a matching table-of-contents id for a numbered heading', () => {
    const resolver = createMarkdownHeadingIdResolver({
      tableOfContentsItems: [{ id: 'implementation', level: 2, title: 'Implementation' }],
    });

    expect(resolver.resolveId('1. Implementation')).toBe('implementation');
  });

  it('creates unique fallback ids for repeated headings', () => {
    const resolver = createMarkdownHeadingIdResolver({ tableOfContentsItems: [] });

    expect(resolver.resolveId('Repeated heading')).toBe('repeated-heading');
    expect(resolver.resolveId('Repeated heading')).toBe('repeated-heading-2');
  });
});
