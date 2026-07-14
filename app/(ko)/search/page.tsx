import { PostSearchView } from '@/components/post-search-view';
import { getPostIndex } from '@/lib/posts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: '제목, 설명, 태그, 시리즈명으로 블로그 글을 검색합니다.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchPage() {
  const posts = getPostIndex().getPostSummaries();

  return <PostSearchView posts={posts} />;
}
