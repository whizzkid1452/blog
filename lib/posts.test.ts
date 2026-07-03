import { describe, expect, it } from 'vitest';
import { isPostFileName } from './posts';

describe('isPostFileName', () => {
  it('accepts Markdown files as post source files', () => {
    expect(isPostFileName('example-post.md')).toBe(true);
  });

  it('does not accept MDX files without an MDX renderer', () => {
    expect(isPostFileName('example-post.mdx')).toBe(false);
  });
});
