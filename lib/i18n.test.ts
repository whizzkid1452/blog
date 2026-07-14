import { describe, expect, it } from 'vitest';
import { createLocalizedPath, getAlternateLocale } from './i18n';

describe('createLocalizedPath', () => {
  it('keeps Korean routes without a locale prefix', () => {
    expect(createLocalizedPath('ko', '/posts/example')).toBe('/posts/example');
  });

  it('prefixes English routes with /en', () => {
    expect(createLocalizedPath('en', '/posts/example')).toBe('/en/posts/example');
  });

  it('uses /en for the English home route', () => {
    expect(createLocalizedPath('en', '/')).toBe('/en');
  });
});

describe('getAlternateLocale', () => {
  it('returns the other supported locale', () => {
    expect(getAlternateLocale('ko')).toBe('en');
    expect(getAlternateLocale('en')).toBe('ko');
  });
});
