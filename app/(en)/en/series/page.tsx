import { SeriesView } from '@/features/posts/ui/post-collection/series-view';
import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Series',
  description: 'English blog posts grouped by series in reading order.',
  alternates: {
    canonical: '/en/series',
  },
};

export default function EnglishSeriesPage() {
  const series = getPostIndexForLocale('en').getSeries();

  return <SeriesView locale="en" series={series} />;
}
