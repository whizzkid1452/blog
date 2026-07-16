import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from './database-types';
import { SupabaseCommentRepository } from './supabase-comment-repository';

const COMMENT_ROW = {
  id: '0198a51a-4f4e-7ef0-82c3-8aaabb74fd33',
  post_slug: 'first-post',
  author_name: '민수',
  content: '좋은 글 감사합니다.',
  created_at: '2026-07-14T06:00:00.000Z',
};

describe('SupabaseCommentRepository', () => {
  it('queries comments by post slug in ascending creation order', async () => {
    const queryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: [COMMENT_ROW], error: null }),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseCommentRepository(supabaseClient);

    const comments = await repository.findByPostSlug('first-post');

    expect(supabaseClient.from).toHaveBeenCalledWith('comments');
    expect(queryBuilder.eq).toHaveBeenCalledWith('post_slug', 'first-post');
    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(comments).toEqual([
      {
        id: COMMENT_ROW.id,
        postSlug: COMMENT_ROW.post_slug,
        authorName: COMMENT_ROW.author_name,
        content: COMMENT_ROW.content,
        createdAt: COMMENT_ROW.created_at,
      },
    ]);
  });

  it('inserts and returns a comment', async () => {
    const queryBuilder = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: COMMENT_ROW, error: null }),
    };
    queryBuilder.insert.mockReturnValue(queryBuilder);
    queryBuilder.select.mockReturnValue(queryBuilder);
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseCommentRepository(supabaseClient);

    const comment = await repository.create({
      postSlug: 'first-post',
      authorName: '민수',
      content: '좋은 글 감사합니다.',
    });

    expect(queryBuilder.insert).toHaveBeenCalledWith({
      post_slug: 'first-post',
      author_name: '민수',
      content: '좋은 글 감사합니다.',
    });
    expect(comment.id).toBe(COMMENT_ROW.id);
  });

  it('does not expose a Supabase query error directly', async () => {
    const supabaseError = { message: 'relation public.comments does not exist' };
    const queryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: null, error: supabaseError }),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseCommentRepository(supabaseClient);

    await expect(repository.findByPostSlug('first-post')).rejects.toThrow('댓글 목록 조회에 실패했습니다.');
  });
});
