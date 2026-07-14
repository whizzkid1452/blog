import { HomeView } from '@/components/home-view';
import { getPostIndexForLocale } from '@/lib/post-translations';
import { createPostsPageMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createPostsPageMetadata('en');

export default function EnglishPostsPage() {
  const posts = getPostIndexForLocale('en').getPostSummaries();

  return (
    <HomeView
      locale="en"
      posts={posts}
      eyebrow="Archive"
      title="Posts"
      description="All English posts, ordered from newest to oldest."
      emptyMessage="No English posts published yet."
    />
  );
}
