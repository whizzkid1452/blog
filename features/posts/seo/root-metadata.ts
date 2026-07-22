import type { Metadata } from 'next';
import {
  RSS_FEED_PATH,
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  createAbsoluteUrl,
  getSiteUrl,
} from '@/shared/config/site-config';
import { createSeoImage } from './seo-metadata-helpers';

export function createRootMetadata(): Metadata {
  const homeUrl = createAbsoluteUrl('/');
  const image = createSeoImage();

  return {
    metadataBase: getSiteUrl(),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    authors: [{ name: SITE_AUTHOR_NAME, url: SITE_AUTHOR_URL }],
    creator: SITE_AUTHOR_NAME,
    publisher: SITE_AUTHOR_NAME,
    alternates: {
      canonical: homeUrl,
      types: { 'application/rss+xml': createAbsoluteUrl(RSS_FEED_PATH) },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: homeUrl,
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
