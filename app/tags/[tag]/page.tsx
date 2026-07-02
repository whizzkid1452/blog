import { HomeView } from '@/components/home-view';
import { getPostSummariesByTag, getTags } from '@/lib/posts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface TagPageProps {
  params: Promise<{
    tag: string;
  }>;
}

export function generateStaticParams() {
  return getTags().map(tag => ({
    tag,
  }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;

  if (!getTags().includes(tag)) {
    return {};
  }

  return {
    title: `#${tag}`,
    description: `Published blog posts tagged with ${tag}.`,
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;

  if (!getTags().includes(tag)) {
    notFound();
  }

  const posts = getPostSummariesByTag(tag);

  return (
    <HomeView
      posts={posts}
      eyebrow="Tag"
      title={`#${tag}`}
      description={`Published writing tagged with ${tag}.`}
      emptyMessage={`No posts tagged with ${tag}.`}
    />
  );
}
