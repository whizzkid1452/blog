import { PostView } from '@/features/posts/ui/post-view/post-view';
import { getViewablePost } from '@/features/authentication/server/post-access';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { createPostPageMetadata } from '@/features/posts/seo/seo-metadata';
import { createPostBreadcrumbJsonLd, createPostJsonLd } from '@/features/posts/seo/structured-data';
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

export const dynamicParams = true;

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getViewablePost({
    postIndex: getPostIndex(),
    slug,
    returnPath: `/posts/${slug}`,
  });

  if (!post) {
    return {};
  }

  if (post.visibility === 'authenticated') {
    return {
      title: post.title,
      robots: { index: false, follow: false, noarchive: true },
    };
  }

  return createPostPageMetadata(post);
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const postIndex = getPostIndex();
  const post = await getViewablePost({ postIndex, slug, returnPath: `/posts/${slug}` });

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
