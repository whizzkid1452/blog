import { describe, expect, it } from 'vitest';
import { getSearchQuery } from './search-query';

describe('getSearchQuery', () => {
  it('returns a single query string', () => {
    expect(getSearchQuery({ q: 'react' })).toBe('react');
  });

  it('uses the first value when the query parameter is repeated', () => {
    expect(getSearchQuery({ q: ['react', 'worker'] })).toBe('react');
  });

  it('returns an empty query when the parameter is absent', () => {
    expect(getSearchQuery({})).toBe('');
  });
});
