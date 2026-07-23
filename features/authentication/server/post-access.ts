import type { PostIndex } from '@/features/posts/model/post-index';
import type { Post } from '@/features/posts/model/post';
import { requireAuthorizedGoogleUser } from './google-user';

interface GetViewablePostParams {
  postIndex: PostIndex;
  slug: string;
  returnPath: string;
}

interface PostAccessDependencies {
  requireAuthorizedViewer(returnPath: string): Promise<unknown>;
}

type GetViewablePost = (params: GetViewablePostParams) => Promise<Post | null>;

export function createPostAccess(dependencies: PostAccessDependencies): GetViewablePost {
  return async ({ postIndex, slug, returnPath }) => {
    const publicPost = postIndex.getPostBySlug(slug);

    if (publicPost != null) {
      return publicPost;
    }

    const authorizedPost = postIndex.getPostBySlugForAuthorizedViewer(slug);

    if (authorizedPost == null) {
      return null;
    }

    await dependencies.requireAuthorizedViewer(returnPath);

    return authorizedPost;
  };
}

export const getViewablePost = createPostAccess({
  requireAuthorizedViewer: requireAuthorizedGoogleUser,
});
