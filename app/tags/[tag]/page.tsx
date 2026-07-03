import { HomeView } from '@/components/home-view';
import { getPostSummariesByTag, getTags } from '@/lib/posts';
import { createTagPageMetadata } from '@/lib/seo-metadata';
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

export const dynamicParams = false;

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;

  if (!getTags().includes(tag)) {
    return {};
  }

  return createTagPageMetadata(tag);
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
