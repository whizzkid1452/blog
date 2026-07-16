import { describe, expect, it } from 'vitest';
import { PostIndex } from '../model/post-index';
import type { Post, PostVisibility } from '../model/post';
import { createPostPreviewImageResponse } from './post-preview-image';

describe('createPostPreviewImageResponse', () => {
  it('returns a PNG preview for a public post', () => {
    const response = createPostPreviewImageResponse({
      postIndex: new PostIndex([createPost()]),
      slug: 'post',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });

  it('does not expose a preview for an authenticated post', () => {
    const response = createPostPreviewImageResponse({
      postIndex: new PostIndex([createPost('authenticated')]),
      slug: 'post',
    });

    expect(response.status).toBe(404);
  });
});

function createPost(visibility: PostVisibility = 'public'): Post {
  return {
    slug: 'post',
    title: 'Post title',
    description: 'Post description',
    date: '2026-07-16',
    tags: ['nextjs'],
    visibility,
    draft: false,
    content: 'Post content',
  };
}
