import { describe, expect, it, vi } from 'vitest';
import { createCommentsApiClient } from './comments-api-client';

const COMMENT = {
  id: '0198a51a-4f4e-7ef0-82c3-8aaabb74fd33',
  postSlug: 'post-one',
  authorName: '민수',
  content: '좋은 글입니다.',
  createdAt: '2026-07-16T00:00:00.000Z',
};

describe('createCommentsApiClient', () => {
  it('encodes the post slug and validates the list response', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ comments: [COMMENT] }), { status: 200 }));
    const client = createCommentsApiClient({ postSlug: 'post-one', fetchImplementation });

    await expect(client.list()).resolves.toEqual([COMMENT]);
    expect(fetchImplementation).toHaveBeenCalledWith('/api/posts/post-one/comments', {
      cache: 'no-store',
      signal: undefined,
    });
  });

  it('sends a validated create payload and returns the created comment', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ comment: COMMENT }), { status: 201 }));
    const client = createCommentsApiClient({ postSlug: 'post-1', fetchImplementation });
    const input = { authorName: '민수', content: '좋은 글입니다.' };

    await expect(client.create(input)).resolves.toEqual(COMMENT);
    expect(fetchImplementation).toHaveBeenCalledWith('/api/posts/post-1/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });
});
