import { PostIndex } from '@/features/posts/model/post-index';
import type { Post } from '@/features/posts/model/post';
import { createPostAccess } from './post-access';
import { describe, expect, it, vi } from 'vitest';

describe('post access', () => {
  it('returns a public post without requiring authentication', async () => {
    const requireAuthenticatedViewer = vi.fn();
    const getViewablePost = createPostAccess({ requireAuthenticatedViewer });
    const postIndex = new PostIndex([createPost({ slug: 'public-post' })]);

    await expect(
      getViewablePost({ postIndex, slug: 'public-post', returnPath: '/posts/public-post' })
    ).resolves.toMatchObject({ slug: 'public-post' });
    expect(requireAuthenticatedViewer).not.toHaveBeenCalled();
  });

  it('requires authentication before returning an authenticated post', async () => {
    const requireAuthenticatedViewer = vi.fn().mockResolvedValue({ id: 'user-1' });
    const getViewablePost = createPostAccess({ requireAuthenticatedViewer });
    const postIndex = new PostIndex([createPost({ slug: 'authenticated-post', visibility: 'authenticated' })]);

    await expect(
      getViewablePost({ postIndex, slug: 'authenticated-post', returnPath: '/posts/authenticated-post' })
    ).resolves.toMatchObject({ slug: 'authenticated-post' });
    expect(requireAuthenticatedViewer).toHaveBeenCalledOnce();
    expect(requireAuthenticatedViewer).toHaveBeenCalledWith('/posts/authenticated-post');
  });

  it('does not require authentication for an unknown slug', async () => {
    const requireAuthenticatedViewer = vi.fn();
    const getViewablePost = createPostAccess({ requireAuthenticatedViewer });
    const postIndex = new PostIndex([]);

    await expect(getViewablePost({ postIndex, slug: 'missing', returnPath: '/posts/missing' })).resolves.toBeNull();
    expect(requireAuthenticatedViewer).not.toHaveBeenCalled();
  });
});

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    slug: 'post',
    title: 'Post title',
    description: 'Post description',
    date: '2026-07-01',
    tags: ['nextjs'],
    draft: false,
    visibility: 'public',
    content: 'Post content',
    ...overrides,
  };
}
