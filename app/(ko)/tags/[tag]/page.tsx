import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { createTagPageMetadata } from '@/features/posts/seo/seo-metadata';
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

  return createTagPageMetadata(tag);
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const postIndex = getPostIndex();

  if (!postIndex.getTags().includes(tag)) {
    notFound();
  }

  const posts = postIndex.getPostSummariesByTag(tag);

  return (
    <PostListView
      posts={posts}
      eyebrow="Tag"
      title={`#${tag}`}
      description={`Published writing tagged with ${tag}.`}
      emptyMessage={`No posts tagged with ${tag}.`}
    />
  );
}
