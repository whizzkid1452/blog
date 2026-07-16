import type { PostIndex } from '../model/post-index';
import { createPostOpenGraphImage } from '../ui/post-open-graph-image/post-open-graph-image';

interface PostPreviewImageOptions {
  postIndex: PostIndex;
  slug: string;
}

export function createPostPreviewImageResponse({ postIndex, slug }: PostPreviewImageOptions): Response {
  const post = postIndex.getPostBySlug(slug);

  return post == null ? new Response('Not found', { status: 404 }) : createPostOpenGraphImage(post);
}
