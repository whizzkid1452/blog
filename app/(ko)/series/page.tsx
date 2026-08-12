import { SeriesView } from '@/features/posts/ui/post-collection/series-view';
import { getPostIndex } from '@/features/posts/server/post-repository';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '시리즈',
  description: '연속된 주제의 블로그 글을 시리즈별 읽기 순서로 모았습니다.',
  alternates: {
    canonical: '/series',
  },
};

export default function SeriesPage() {
  const series = getPostIndex().getSeries();

  return <SeriesView series={series} />;
}
