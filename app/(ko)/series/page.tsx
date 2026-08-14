import { SeriesView } from '@/features/posts/ui/post-collection/series-view';
import { getPostIndex } from '@/features/posts/server/post-repository';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '시리즈',
  description: '기술적 임팩트가 큰 시리즈부터, 각 시리즈 안에서는 읽는 순서대로 모았습니다.',
  alternates: {
    canonical: '/series',
  },
};

export default function SeriesPage() {
  const series = getPostIndex().getSeries();

  return <SeriesView series={series} />;
}
