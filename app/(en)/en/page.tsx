import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import { createHomeMetadata } from '@/features/posts/seo/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createHomeMetadata('en');

export default function EnglishHomePage() {
  const posts = getPostIndexForLocale('en').getPostSummaries();

  return (
    <PostListView
      locale="en"
      posts={posts}
      eyebrow="Personal notes"
      description="Essays, engineering notes, and implementation logs available in English."
      emptyMessage="No English posts published yet."
    />
  );
}
