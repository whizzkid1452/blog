import type { Metadata } from 'next';
import type { Post } from './posts';
import { getPostPublishedDateTime } from './posts';
import { createPostDescription } from './seo';
import {
  DEFAULT_OG_IMAGE_PATH,
  RSS_FEED_PATH,
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  createAbsoluteUrl,
  getSiteUrl,
} from './site-config';

const POSTS_PAGE_TITLE = 'Posts';
const POSTS_PAGE_DESCRIPTION = '공개된 모든 글을 최신순으로 모아둔 글 목록입니다.';
const DEFAULT_OG_IMAGE_ALT = `${SITE_NAME} social preview image`;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export function createRootMetadata(): Metadata {
  const image = createSeoImage();

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    authors: [
      {
        name: SITE_AUTHOR_NAME,
        url: SITE_AUTHOR_URL,
      },
    ],
    creator: SITE_AUTHOR_NAME,
    publisher: SITE_AUTHOR_NAME,
    alternates: {
      types: {
        'application/rss+xml': createAbsoluteUrl(RSS_FEED_PATH),
      },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: createAbsoluteUrl('/'),
      locale: 'ko_KR',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [image.url],
    },
  };
}

export function createHomeMetadata(): Metadata {
  return {
    alternates: {
      canonical: createAbsoluteUrl('/'),
    },
  };
}

export function createPostsPageMetadata(): Metadata {
  const url = createAbsoluteUrl('/posts');
  const image = createSeoImage();

  return {
    title: POSTS_PAGE_TITLE,
    description: POSTS_PAGE_DESCRIPTION,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      title: POSTS_PAGE_TITLE,
      description: POSTS_PAGE_DESCRIPTION,
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: POSTS_PAGE_TITLE,
      description: POSTS_PAGE_DESCRIPTION,
      images: [image.url],
    },
  };
}

export function createTagPageMetadata(tag: string): Metadata {
  const title = `#${tag}`;
  const description = createTagDescription(tag);
  const url = createAbsoluteUrl(`/tags/${encodeURIComponent(tag)}`);
  const image = createSeoImage();

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}

export function createPostPageMetadata(post: Post): Metadata {
  const description = createPostDescription({ description: post.description, content: post.content });
  const url = createAbsoluteUrl(`/posts/${post.slug}`);
  const image = createSeoImage(getPostOpenGraphImagePath(post), post.coverAlt ?? post.title);

  return {
    title: post.title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url,
      publishedTime: getPostPublishedDateTime(post),
      authors: [SITE_AUTHOR_NAME],
      tags: post.tags,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [image.url],
    },
  };
}

function createTagDescription(tag: string): string {
  return `${tag} 태그가 붙은 공개 글 목록입니다.`;
}

function createSeoImage(pathname = DEFAULT_OG_IMAGE_PATH, alt = DEFAULT_OG_IMAGE_ALT): SeoImage {
  return {
    url: createAbsoluteUrl(pathname),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt,
  };
}

function getPostOpenGraphImagePath(post: Post): string {
  return post.coverImage ?? `/posts/${post.slug}/opengraph-image`;
}
