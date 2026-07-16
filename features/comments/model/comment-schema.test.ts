import { describe, expect, it } from 'vitest';
import { commentListResponseSchema, createCommentSchema, postSlugSchema } from './comment-schema';

describe('createCommentSchema', () => {
  it('trims a valid author name and comment content', () => {
    const result = createCommentSchema.parse({
      authorName: '  민수  ',
      content: '  좋은 글 감사합니다.  ',
    });

    expect(result).toEqual({
      authorName: '민수',
      content: '좋은 글 감사합니다.',
    });
  });

  it('rejects an empty author name', () => {
    const result = createCommentSchema.safeParse({
      authorName: '   ',
      content: '댓글',
    });

    expect(result.success).toBe(false);
  });

  it('rejects comment content longer than 1,000 characters', () => {
    const result = createCommentSchema.safeParse({
      authorName: '민수',
      content: '가'.repeat(1_001),
    });

    expect(result.success).toBe(false);
  });
});

describe('postSlugSchema', () => {
  it('accepts a kebab-case post slug', () => {
    expect(postSlugSchema.parse('supabase-comment-feature')).toBe('supabase-comment-feature');
  });

  it('rejects a path-like post slug', () => {
    expect(postSlugSchema.safeParse('../admin').success).toBe(false);
  });
});

describe('commentListResponseSchema', () => {
  it('rejects a comment response with an invalid timestamp', () => {
    const result = commentListResponseSchema.safeParse({
      comments: [
        {
          id: '0198a51a-4f4e-7ef0-82c3-8aaabb74fd33',
          postSlug: 'first-post',
          authorName: '민수',
          content: '댓글',
          createdAt: 'not-a-date',
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
