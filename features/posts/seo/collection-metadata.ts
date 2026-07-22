import type { Metadata } from 'next';
import { createAbsoluteUrl } from '@/shared/config/site-config';
import { createSeoImage } from './seo-metadata-helpers';

const POSTS_PAGE_TITLE = 'Posts';
const POSTS_PAGE_DESCRIPTION = '공개된 모든 글을 최신순으로 모아둔 글 목록입니다.';

export function createPostsPageMetadata(): Metadata {
  return createCollectionMetadata({
    title: POSTS_PAGE_TITLE,
    description: POSTS_PAGE_DESCRIPTION,
    url: createAbsoluteUrl('/posts'),
  });
}

export function createTagPageMetadata(tag: string): Metadata {
  const pathname = `/tags/${encodeURIComponent(tag)}`;

  return createCollectionMetadata({
    title: `#${tag}`,
    description: `${tag} 태그가 붙은 공개 글 목록입니다.`,
    url: createAbsoluteUrl(pathname),
  });
}

function createCollectionMetadata({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}): Metadata {
  const image = createSeoImage();

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}
