import type { Post } from './posts';
import { getPostPublishedDateTime } from './posts';
import { createPostDescription } from './seo';
import { SITE_AUTHOR_NAME, SITE_AUTHOR_URL, createAbsoluteUrl } from './site-config';

export function createPostJsonLd(post: Post): string {
  const url = createAbsoluteUrl(`/posts/${post.slug}`);
  const publishedTime = getPostPublishedDateTime(post);
  const image = createAbsoluteUrl(post.coverImage ?? `/posts/${post.slug}/opengraph-image`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: createPostDescription({ description: post.description, content: post.content }),
    datePublished: publishedTime,
    dateModified: publishedTime,
    image,
    url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Person',
      name: SITE_AUTHOR_NAME,
      url: SITE_AUTHOR_URL,
    },
    keywords: post.tags,
  };

  return escapeJsonLd(jsonLd);
}

function escapeJsonLd(jsonLd: object): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}
