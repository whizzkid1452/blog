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
      title="전체 글"
      description="공개된 글을 최신순으로 모았습니다."
      emptyMessage="등록된 글이 없습니다."
    />
  );
}
