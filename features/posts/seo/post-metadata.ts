import type { Metadata } from 'next';
import { SITE_AUTHOR_NAME, createAbsoluteUrl } from '@/shared/config/site-config';
import type { Post } from '../model/post';
import { getPostPublishedDateTime } from '../server/post-repository';
import { createPostDescription } from './post-description';
import { createSeoImage } from './seo-metadata-helpers';

export function createPostPageMetadata(post: Post): Metadata {
  const description = createPostDescription({ description: post.description, content: post.content });
  const pathname = `/posts/${post.slug}`;
  const url = createAbsoluteUrl(pathname);
  const imagePath = post.coverImage ?? `/posts/${post.slug}/opengraph-image`;
  const image = createSeoImage(imagePath, post.coverAlt ?? post.title);

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
