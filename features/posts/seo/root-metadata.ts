import type { Metadata } from 'next';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getOpenGraphLocale } from '@/shared/i18n/i18n';
import {
  RSS_FEED_PATH,
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_NAME,
  createAbsoluteUrl,
  getSiteDescription,
  getSiteUrl,
} from '@/shared/config/site-config';
import { createAlternateLanguages, createSeoImage } from './seo-metadata-helpers';

export function createRootMetadata(locale: Locale = 'ko'): Metadata {
  const description = getSiteDescription(locale);
  const homeUrl = createAbsoluteUrl(createLocalizedPath(locale, '/'));
  const image = createSeoImage();

  return {
    metadataBase: getSiteUrl(),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description,
    authors: [{ name: SITE_AUTHOR_NAME, url: SITE_AUTHOR_URL }],
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
