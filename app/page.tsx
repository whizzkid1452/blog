import { HomeView } from '@/components/home-view';
import { getPostIndex } from '@/lib/posts';
import { createHomeMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';

export const dynamic = 'error';

export const metadata: Metadata = createHomeMetadata();

export default function Home() {
  const posts = getPostIndex().getPostSummaries();

  return <HomeView posts={posts} />;
}
