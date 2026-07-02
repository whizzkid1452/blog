import { HomeView } from '@/components/home-view';
import { getPostSummaries } from '@/lib/posts';

export default function Home() {
  const posts = getPostSummaries();

  return <HomeView posts={posts} />;
}
