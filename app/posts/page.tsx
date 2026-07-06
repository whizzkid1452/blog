import { HomeView } from '@/components/home-view';
import { getPostIndex } from '@/lib/posts';
import { createPostsPageMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';

export const dynamic = 'error';

export const metadata: Metadata = createPostsPageMetadata();

export default function PostsPage() {
  const posts = getPostIndex().getPostSummaries();

  return (
    <HomeView
      posts={posts}
      eyebrow="Archive"
      title="Posts"
      description="All published writing, ordered from newest to oldest."
      emptyMessage="No posts published yet."
    />
  );
}
