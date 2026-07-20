import { describe, expect, it } from 'vitest';
import { createMarkdownHeadingIdResolver } from './markdown-heading-id';

describe('createMarkdownHeadingIdResolver', () => {
  it('uses a prepared heading id', () => {
    const resolver = createMarkdownHeadingIdResolver({
      headingIds: ['implementation'],
    });

    expect(resolver.resolveId('1. Implementation')).toBe('implementation');
  });

  it('creates unique fallback ids for repeated headings', () => {
    const resolver = createMarkdownHeadingIdResolver({ headingIds: [] });

    expect(resolver.resolveId('Repeated heading')).toBe('repeated-heading');
    expect(resolver.resolveId('Repeated heading')).toBe('repeated-heading-2');
  });
});
