import { HomeView } from '@/components/home-view';
import { getPostSummaries } from '@/lib/posts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Posts',
  description: 'All published blog posts.',
};

export default function PostsPage() {
  const posts = getPostSummaries();

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
