import { PostSearchView } from '@/components/post-search-view';
import { getPostIndex } from '@/lib/posts';
import { getSearchQuery } from '@/lib/search-query';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: '제목, 설명, 태그, 시리즈명으로 블로그 글을 검색합니다.',
  robots: {
    index: false,
    follow: true,
  },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const posts = getPostIndex().getPostSummaries();
  const query = getSearchQuery(await searchParams);

  return <PostSearchView posts={posts} query={query} />;
}
