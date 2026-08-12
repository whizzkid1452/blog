import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { createHomeMetadata } from '@/features/posts/seo/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createHomeMetadata();

export default function Home() {
  const posts = getPostIndex().getFeaturedPostSummaries();

  return <PostListView posts={posts} eyebrow="대표 글" />;
}
