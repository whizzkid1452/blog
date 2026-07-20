import type { Metadata } from 'next';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import { SITE_AUTHOR_NAME, createAbsoluteUrl } from '@/shared/config/site-config';
import type { Post } from '../model/post';
import { getPostPublishedDateTime } from '../server/post-repository';
import { createPostDescription } from './post-description';
import { createAlternateLanguages, createSeoImage, type LocalizedMetadataOptions } from './seo-metadata-helpers';

export function createPostPageMetadata(post: Post, options: LocalizedMetadataOptions = {}): Metadata {
  const { locale = 'ko', hasAlternateLocale = false } = options;
  const description = createPostDescription({ description: post.description, content: post.content });
  const pathname = `/posts/${post.slug}`;
  const url = createAbsoluteUrl(createLocalizedPath(locale, pathname));
  const imagePath = post.coverImage ?? createLocalizedPath(locale, `/posts/${post.slug}/opengraph-image`);
  const image = createSeoImage(imagePath, post.coverAlt ?? post.title);

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
