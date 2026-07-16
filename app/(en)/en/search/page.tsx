import { PostSearchView } from '@/components/post-search-view';
import { getPostIndexForLocale } from '@/lib/post-translations';
import { getSearchQuery } from '@/lib/search-query';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search English blog posts by title, description, tag, or series name.',
  robots: {
    index: false,
    follow: true,
  },
};

interface EnglishSearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function EnglishSearchPage({ searchParams }: EnglishSearchPageProps) {
  const posts = getPostIndexForLocale('en').getPostSummaries();
  const query = getSearchQuery(await searchParams);

  return <PostSearchView locale="en" posts={posts} query={query} />;
}
