import type { PostIndex } from '@/features/posts/model/post-index';
import type { Post } from '@/features/posts/model/post';
import { requireAuthenticatedGoogleUser } from './google-user';

interface GetViewablePostParams {
  postIndex: PostIndex;
  slug: string;
  returnPath: string;
}

interface PostAccessDependencies {
  requireAuthenticatedViewer(returnPath: string): Promise<unknown>;
}

type GetViewablePost = (params: GetViewablePostParams) => Promise<Post | null>;

export function createPostAccess(dependencies: PostAccessDependencies): GetViewablePost {
  return async ({ postIndex, slug, returnPath }) => {
    const publicPost = postIndex.getPostBySlug(slug);

    if (publicPost != null) {
      return publicPost;
    }

    const authenticatedPost = postIndex.getPostBySlugForAuthenticatedViewer(slug);

    if (authenticatedPost == null) {
      return null;
    }

    await dependencies.requireAuthenticatedViewer(returnPath);

    return authenticatedPost;
  };
}

export const getViewablePost = createPostAccess({
  requireAuthenticatedViewer: requireAuthenticatedGoogleUser,
});
