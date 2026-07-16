import type { Metadata } from 'next';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getOpenGraphLocale } from '@/shared/i18n/i18n';
import type { Post } from '../model/post';
import { getPostPublishedDateTime } from '../server/post-repository';
import { createPostDescription } from './post-description';
import {
  DEFAULT_OG_IMAGE_PATH,
  RSS_FEED_PATH,
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_NAME,
  createAbsoluteUrl,
  getSiteDescription,
  getSiteUrl,
} from '@/shared/config/site-config';

const POSTS_PAGE_TITLE = 'Posts';
const POSTS_PAGE_DESCRIPTIONS: Record<Locale, string> = {
  ko: '공개된 모든 글을 최신순으로 모아둔 글 목록입니다.',
  en: 'All English posts, ordered from newest to oldest.',
};
const DEFAULT_OG_IMAGE_ALT = `${SITE_NAME} social preview image`;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

interface LocalizedMetadataOptions {
  locale?: Locale;
  hasAlternateLocale?: boolean;
}

export function createRootMetadata(locale: Locale = 'ko'): Metadata {
  const description = getSiteDescription(locale);
  const homeUrl = createAbsoluteUrl(createLocalizedPath(locale, '/'));
  const image = createSeoImage();

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    authors: [
      {
        name: SITE_AUTHOR_NAME,
        url: SITE_AUTHOR_URL,
      },
    ],
    creator: SITE_AUTHOR_NAME,
    publisher: SITE_AUTHOR_NAME,
    alternates: {
      canonical: homeUrl,
      languages: createAlternateLanguages('/'),
      types: locale === 'ko' ? { 'application/rss+xml': createAbsoluteUrl(RSS_FEED_PATH) } : undefined,
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
      description,
      url: homeUrl,
      locale: getOpenGraphLocale(locale),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description,
      images: [image.url],
    },
  };
}

export function createHomeMetadata(locale: Locale = 'ko'): Metadata {
  return {
    alternates: {
      canonical: createAbsoluteUrl(createLocalizedPath(locale, '/')),
      languages: createAlternateLanguages('/'),
    },
  };
}

export function createPostsPageMetadata(locale: Locale = 'ko'): Metadata {
  const url = createAbsoluteUrl(createLocalizedPath(locale, '/posts'));
  const description = POSTS_PAGE_DESCRIPTIONS[locale];
  const image = createSeoImage();

  return {
    title: POSTS_PAGE_TITLE,
    description,
    alternates: {
      canonical: url,
      languages: createAlternateLanguages('/posts'),
    },
    openGraph: {
      type: 'website',
      title: POSTS_PAGE_TITLE,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: POSTS_PAGE_TITLE,
      description,
      images: [image.url],
    },
  };
}

export function createTagPageMetadata(tag: string, options: LocalizedMetadataOptions = {}): Metadata {
  const { locale = 'ko', hasAlternateLocale = false } = options;
  const title = `#${tag}`;
  const description = createTagDescription(tag, locale);
  const pathname = `/tags/${encodeURIComponent(tag)}`;
  const url = createAbsoluteUrl(createLocalizedPath(locale, pathname));
  const image = createSeoImage();

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: hasAlternateLocale ? createAlternateLanguages(pathname) : undefined,
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

export function createPostPageMetadata(post: Post, options: LocalizedMetadataOptions = {}): Metadata {
  const { locale = 'ko', hasAlternateLocale = false } = options;
  const description = createPostDescription({ description: post.description, content: post.content });
  const pathname = `/posts/${post.slug}`;
  const url = createAbsoluteUrl(createLocalizedPath(locale, pathname));
  const image = createSeoImage(getPostOpenGraphImagePath(post, locale), post.coverAlt ?? post.title);

  return {
    title: post.title,
    description,
    alternates: {
      canonical: url,
      languages: hasAlternateLocale ? createAlternateLanguages(pathname) : undefined,
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

function createTagDescription(tag: string, locale: Locale): string {
  return locale === 'ko' ? `${tag} 태그가 붙은 공개 글 목록입니다.` : `English posts tagged with ${tag}.`;
}

function createSeoImage(pathname = DEFAULT_OG_IMAGE_PATH, alt = DEFAULT_OG_IMAGE_ALT): SeoImage {
  return {
    url: createAbsoluteUrl(pathname),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt,
  };
}

function getPostOpenGraphImagePath(post: Post, locale: Locale): string {
  return post.coverImage ?? createLocalizedPath(locale, `/posts/${post.slug}/opengraph-image`);
}

function createAlternateLanguages(pathname: string): Record<string, string> {
  return {
    'ko-KR': createAbsoluteUrl(createLocalizedPath('ko', pathname)),
    'en-US': createAbsoluteUrl(createLocalizedPath('en', pathname)),
  };
}
