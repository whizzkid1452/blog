import { HomeView } from '@/components/home-view';
import { getPostIndexForLocale } from '@/lib/post-translations';
import { getPostIndex } from '@/lib/posts';
import { createTagPageMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface TagPageProps {
  params: Promise<{
    tag: string;
  }>;
}

export function generateStaticParams() {
  return getPostIndex()
    .getTags()
    .map(tag => ({
      tag,
    }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const postIndex = getPostIndex();

  if (!postIndex.getTags().includes(tag)) {
    return {};
  }

  return createTagPageMetadata(tag, {
    locale: 'ko',
    hasAlternateLocale: getPostIndexForLocale('en').getTags().includes(tag),
  });
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const postIndex = getPostIndex();

  if (!postIndex.getTags().includes(tag)) {
    notFound();
  }

  const posts = postIndex.getPostSummariesByTag(tag);

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
