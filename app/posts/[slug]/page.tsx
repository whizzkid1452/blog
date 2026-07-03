import { PostView } from '@/components/post-view';
import { getPostBySlug, getPostSummaries, getRelatedPostSummaries } from '@/lib/posts';
import { createPostPageMetadata } from '@/lib/seo-metadata';
import { createPostJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return getPostSummaries().map(post => ({
    slug: post.slug,
  }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {};
  }

  return createPostPageMetadata(post);
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPostSummaries(post);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostJsonLd(post) }} />
      <PostView post={post} relatedPosts={relatedPosts} />
    </>
  );
}
