import { HomeView } from '@/components/home-view';
import { getPostSummaries } from '@/lib/posts';
import { createHomeMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createHomeMetadata();

export default function Home() {
  const posts = getPostSummaries();

  return <HomeView posts={posts} />;
}
