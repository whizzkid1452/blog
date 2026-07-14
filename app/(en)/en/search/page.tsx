import { PostSearchView } from '@/components/post-search-view';
import { getPostIndexForLocale } from '@/lib/post-translations';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search English blog posts by title, description, tag, or series name.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function EnglishSearchPage() {
  const posts = getPostIndexForLocale('en').getPostSummaries();

  return <PostSearchView locale="en" posts={posts} />;
}
