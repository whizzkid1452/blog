import type { Metadata } from 'next';
import type { Post } from './posts';
import { getPostPublishedDateTime } from './posts';
import { createPostDescription } from './seo';
import {
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  createAbsoluteUrl,
  getSiteUrl,
} from './site-config';

const POSTS_PAGE_TITLE = 'Posts';
const POSTS_PAGE_DESCRIPTION = '공개된 모든 글을 최신순으로 모아둔 글 목록입니다.';

export function createRootMetadata(): Metadata {
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
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: createAbsoluteUrl('/'),
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary',
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
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
    },
    twitter: {
      card: 'summary',
      title: POSTS_PAGE_TITLE,
      description: POSTS_PAGE_DESCRIPTION,
    },
  };
}

export function createTagPageMetadata(tag: string): Metadata {
  const title = `#${tag}`;
  const description = createTagDescription(tag);
  const url = createAbsoluteUrl(`/tags/${encodeURIComponent(tag)}`);

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
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export function createPostPageMetadata(post: Post): Metadata {
  const description = createPostDescription({ description: post.description, content: post.content });
  const url = createAbsoluteUrl(`/posts/${post.slug}`);

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
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description,
    },
  };
}

function createTagDescription(tag: string): string {
  return `${tag} 태그가 붙은 공개 글 목록입니다.`;
}
