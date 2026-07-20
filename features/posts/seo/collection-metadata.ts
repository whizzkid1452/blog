import type { Metadata } from 'next';
import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import { createAbsoluteUrl } from '@/shared/config/site-config';
import { createAlternateLanguages, createSeoImage, type LocalizedMetadataOptions } from './seo-metadata-helpers';

const POSTS_PAGE_TITLE = 'Posts';
const POSTS_PAGE_DESCRIPTIONS: Record<Locale, string> = {
  ko: '공개된 모든 글을 최신순으로 모아둔 글 목록입니다.',
  en: 'All English posts, ordered from newest to oldest.',
};

export function createPostsPageMetadata(locale: Locale = 'ko'): Metadata {
  const url = createAbsoluteUrl(createLocalizedPath(locale, '/posts'));
  const description = POSTS_PAGE_DESCRIPTIONS[locale];

  return createCollectionMetadata({
    title: POSTS_PAGE_TITLE,
    description,
    url,
    alternateLanguages: createAlternateLanguages('/posts'),
  });
}

export function createTagPageMetadata(tag: string, options: LocalizedMetadataOptions = {}): Metadata {
  const { locale = 'ko', hasAlternateLocale = false } = options;
  const pathname = `/tags/${encodeURIComponent(tag)}`;

  return createCollectionMetadata({
    title: `#${tag}`,
    description: locale === 'ko' ? `${tag} 태그가 붙은 공개 글 목록입니다.` : `English posts tagged with ${tag}.`,
    url: createAbsoluteUrl(createLocalizedPath(locale, pathname)),
    alternateLanguages: hasAlternateLocale ? createAlternateLanguages(pathname) : undefined,
  });
}

function createCollectionMetadata({
  title,
  description,
  url,
  alternateLanguages,
}: {
  title: string;
  description: string;
  url: string;
  alternateLanguages?: Record<string, string>;
}): Metadata {
  const image = createSeoImage();

  return {
    title,
    description,
    alternates: { canonical: url, languages: alternateLanguages },
    openGraph: { type: 'website', title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}
