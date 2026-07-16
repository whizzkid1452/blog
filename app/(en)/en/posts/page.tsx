import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import { createPostsPageMetadata } from '@/features/posts/seo/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createPostsPageMetadata('en');

export default function EnglishPostsPage() {
  const posts = getPostIndexForLocale('en').getPostSummaries();

  return (
    <PostListView
      locale="en"
      posts={posts}
      eyebrow="Archive"
      title="Posts"
      description="All English posts, ordered from newest to oldest."
      emptyMessage="No English posts published yet."
    />
  );
}
