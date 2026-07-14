import { PostView } from '@/components/post-view';
import { getViewablePost } from '@/lib/auth/post-access';
import { createLocalizedPath } from '@/lib/i18n';
import { hasEnglishPostTranslation } from '@/lib/post-translations';
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

  return createPostPageMetadata(post, { locale: 'ko', hasAlternateLocale: hasEnglishPostTranslation(slug) });
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const postIndex = getPostIndex();
  const post = await getViewablePost({ postIndex, slug, returnPath: `/posts/${slug}` });

  if (!post) {
    notFound();
  }

  const relatedPosts = postIndex.getRelatedPostSummaries(post);
  const translationHref = hasEnglishPostTranslation(slug)
    ? createLocalizedPath('en', `/posts/${post.slug}`)
    : undefined;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostJsonLd(post) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostBreadcrumbJsonLd(post) }} />
      <PostView post={post} relatedPosts={relatedPosts} translationHref={translationHref} />
    </>
  );
}
