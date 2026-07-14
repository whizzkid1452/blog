import { describe, expect, it } from 'vitest';
import { getSafeReturnPath } from './redirect';

describe('getSafeReturnPath', () => {
  it('keeps a same-origin path with a query string', () => {
    expect(getSafeReturnPath('/posts/private-post?tab=comments')).toBe('/posts/private-post?tab=comments');
  });

  it.each(['https://example.com', '//example.com', '/\\example.com'])('rejects an external return path: %s', value => {
    expect(getSafeReturnPath(value)).toBe('/');
  });

  it('uses the provided fallback when the value is missing', () => {
    expect(getSafeReturnPath(null, '/private-posts')).toBe('/private-posts');
  });
});
