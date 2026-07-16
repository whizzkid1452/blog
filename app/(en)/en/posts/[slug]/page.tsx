import { PostView } from '@/features/posts/ui/post-view/post-view';
import { getViewablePost } from '@/features/authentication/server/post-access';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import { createPostPageMetadata } from '@/features/posts/seo/seo-metadata';
import { createPostBreadcrumbJsonLd, createPostJsonLd } from '@/features/posts/seo/structured-data';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface EnglishPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return getPostIndexForLocale('en')
    .getPostSummaries()
    .map(post => ({ slug: post.slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: EnglishPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getViewablePost({
    postIndex: getPostIndexForLocale('en'),
    slug,
    returnPath: `/en/posts/${slug}`,
  });

  if (post == null) {
    return {};
  }

  if (post.visibility === 'authenticated') {
    return {
      title: post.title,
      robots: { index: false, follow: false, noarchive: true },
    };
  }

  return createPostPageMetadata(post, { locale: 'en', hasAlternateLocale: true });
}

export default async function EnglishPostPage({ params }: EnglishPostPageProps) {
  const { slug } = await params;
  const postIndex = getPostIndexForLocale('en');
  const post = await getViewablePost({ postIndex, slug, returnPath: `/en/posts/${slug}` });

  if (post == null) {
    notFound();
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostJsonLd(post, 'en') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createPostBreadcrumbJsonLd(post, 'en') }} />
      <PostView
        locale="en"
        post={post}
        relatedPosts={postIndex.getRelatedPostSummaries(post)}
        translationHref={createLocalizedPath('ko', `/posts/${post.slug}`)}
      />
    </>
  );
}
