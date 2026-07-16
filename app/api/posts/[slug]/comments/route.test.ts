import type { BlogComment, CommentRepository, CreateCommentInput } from '@/features/comments/model/comment-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCommentRouteHandlers } from '@/features/comments/server/comment-route-handlers';

const POST_SLUG = 'first-post';
const COMMENT: BlogComment = {
  id: '0198a51a-4f4e-7ef0-82c3-8aaabb74fd33',
  postSlug: POST_SLUG,
  authorName: '민수',
  content: '좋은 글 감사합니다.',
  createdAt: '2026-07-14T06:00:00.000Z',
};

function createRepositoryStub() {
  return {
    findByPostSlug: vi.fn<(postSlug: string) => Promise<BlogComment[]>>(),
    create: vi.fn<(input: CreateCommentInput) => Promise<BlogComment>>(),
  } satisfies CommentRepository;
}

function createRouteContext(slug = POST_SLUG) {
  return {
    params: Promise.resolve({ slug }),
  };
}

describe('/api/posts/[slug]/comments', () => {
  const repository = createRepositoryStub();
  const doesPostExist = vi.fn<(postSlug: string) => boolean>();
  const getCommentRepository = vi.fn(() => repository);
  const handlers = createCommentRouteHandlers({
    doesPostExist,
    getCommentRepository,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    doesPostExist.mockReturnValue(true);
    repository.findByPostSlug.mockResolvedValue([COMMENT]);
    repository.create.mockResolvedValue(COMMENT);
  });

  it('returns comments for an existing post without caching', async () => {
    const response = await handlers.GET(new Request('https://blog.example.com/api/posts/first-post/comments'), {
      params: Promise.resolve({ slug: POST_SLUG }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ comments: [COMMENT] });
    expect(repository.findByPostSlug).toHaveBeenCalledWith(POST_SLUG);
  });

  it('returns 404 without querying Supabase when the post does not exist', async () => {
    doesPostExist.mockReturnValue(false);

    const response = await handlers.GET(
      new Request('https://blog.example.com/api/posts/missing-post/comments'),
      createRouteContext('missing-post')
    );

    expect(response.status).toBe(404);
    expect(getCommentRepository).not.toHaveBeenCalled();
  });

  it('creates a trimmed comment for an existing post', async () => {
    const response = await handlers.POST(
      new Request('https://blog.example.com/api/posts/first-post/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://blog.example.com',
        },
        body: JSON.stringify({
          authorName: '  민수  ',
          content: '  좋은 글 감사합니다.  ',
        }),
      }),
      createRouteContext()
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ comment: COMMENT });
    expect(repository.create).toHaveBeenCalledWith({
      postSlug: POST_SLUG,
      authorName: '민수',
      content: '좋은 글 감사합니다.',
    });
  });

  it('rejects invalid comment input', async () => {
    const response = await handlers.POST(
      new Request('https://blog.example.com/api/posts/first-post/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://blog.example.com',
        },
        body: JSON.stringify({
          authorName: '',
          content: '',
        }),
      }),
      createRouteContext()
    );

    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin write request', async () => {
    const response = await handlers.POST(
      new Request('https://blog.example.com/api/posts/first-post/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://malicious.example.com',
        },
        body: JSON.stringify({
          authorName: '민수',
          content: '댓글',
        }),
      }),
      createRouteContext()
    );

    expect(response.status).toBe(403);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns a generic 503 response when comment storage is unavailable', async () => {
    repository.findByPostSlug.mockRejectedValue(new Error('database connection failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await handlers.GET(
      new Request('https://blog.example.com/api/posts/first-post/comments'),
      createRouteContext()
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ message: '댓글을 불러오지 못했습니다.' });
  });
});
