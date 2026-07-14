import { HomeView } from '@/components/home-view';
import { getPostIndexForLocale } from '@/lib/post-translations';
import { createHomeMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createHomeMetadata('en');

export default function EnglishHomePage() {
  const posts = getPostIndexForLocale('en').getPostSummaries();

  return (
    <HomeView
      locale="en"
      posts={posts}
      eyebrow="Personal notes"
      title="Blog"
      description="Essays, engineering notes, and implementation logs available in English."
      emptyMessage="No English posts published yet."
    />
  );
}
