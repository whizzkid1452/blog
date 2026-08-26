import { describe, expect, it } from 'vitest';
import { postFrontmatterSchema } from './post-frontmatter-schema';

describe('postFrontmatterSchema', () => {
  it('accepts zero as the order of a series introduction', () => {
    const result = postFrontmatterSchema.safeParse({
      title: '[Part 0.] Series introduction',
      description: 'Series introduction',
      date: '2026-08-21',
      tags: ['series'],
      series: {
        name: 'Series',
        order: 0,
      },
    });

    expect(result.success).toBe(true);
  });
});
