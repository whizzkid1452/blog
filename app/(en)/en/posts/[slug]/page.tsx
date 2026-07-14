import { PostView } from '@/components/post-view';
import { getViewablePost } from '@/lib/auth/post-access';
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

// 공개 글만 SSG로 생성하고 인증 글은 요청 시 서버에서 권한을 검사한다.
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
