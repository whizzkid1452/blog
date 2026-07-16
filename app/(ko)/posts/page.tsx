import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { createPostsPageMetadata } from '@/features/posts/seo/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createPostsPageMetadata();

export default function PostsPage() {
  const posts = getPostIndex().getPostSummaries();

  return (
    <PostListView
      posts={posts}
      eyebrow="Archive"
      title="Posts"
      description="All published writing, ordered from newest to oldest."
      emptyMessage="No posts published yet."
    />
  );
}
