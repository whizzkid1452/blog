import { describe, expect, it } from 'vitest';
import { createLocalizedPath } from './i18n';

describe('createLocalizedPath', () => {
  it('keeps Korean routes without a locale prefix', () => {
    expect(createLocalizedPath('ko', '/posts/example')).toBe('/posts/example');
  });

  it('normalizes a route without a leading slash', () => {
    expect(createLocalizedPath('ko', 'posts/example')).toBe('/posts/example');
  });
});
