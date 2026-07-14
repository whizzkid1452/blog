import { PostView } from '@/components/post-view';
import { createLocalizedPath } from '@/lib/i18n';
import { getPostIndexForLocale } from '@/lib/post-translations';
import { createPostPageMetadata } from '@/lib/seo-metadata';
import { createPostBreadcrumbJsonLd, createPostJsonLd } from '@/lib/structured-data';
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

export const dynamicParams = false;

export async function generateMetadata({ params }: EnglishPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostIndexForLocale('en').getPostBySlug(slug);

  return post == null ? {} : createPostPageMetadata(post, { locale: 'en', hasAlternateLocale: true });
}

export default async function EnglishPostPage({ params }: EnglishPostPageProps) {
  const { slug } = await params;
  const postIndex = getPostIndexForLocale('en');
  const post = postIndex.getPostBySlug(slug);

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
