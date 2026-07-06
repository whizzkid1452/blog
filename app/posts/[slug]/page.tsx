import { PostView } from '@/components/post-view';
import { getPostIndex } from '@/lib/posts';
import { createPostPageMetadata } from '@/lib/seo-metadata';
import { createPostBreadcrumbJsonLd, createPostJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return getPostIndex()
    .getPostSummaries()
    .map(post => ({
      slug: post.slug,
    }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostIndex().getPostBySlug(slug);

  if (!post) {
    return {};
  }

  return createPostPageMetadata(post);
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const postIndex = getPostIndex();
  const post = postIndex.getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = postIndex.getRelatedPostSummaries(post);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostJsonLd(post) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostBreadcrumbJsonLd(post) }} />
      <PostView post={post} relatedPosts={relatedPosts} />
    </>
  );
}
