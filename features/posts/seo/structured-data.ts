import {
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_NAME,
  createAbsoluteUrl,
} from '@/shared/config/site-config';
import type { Post } from '../model/post';
import { getPostPublishedDateTime } from '../server/post-repository';
import { createPostDescription } from './post-description';

const PERSON_ID_PATH = '/#person';
const ARTICLE_ID_SUFFIX = '#article';
const WEBSITE_ID_SUFFIX = '#website';

interface SchemaReference {
  '@id': string;
}

interface SchemaPerson {
  '@type': 'Person';
  '@id': string;
  name: string;
  url: string;
}

interface SchemaListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export function createSiteJsonLd(): string {
  const person = createAuthorSchema();
  const homeUrl = createAbsoluteUrl('/');
  const website = {
    '@type': 'WebSite',
    '@id': `${homeUrl}${WEBSITE_ID_SUFFIX}`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: homeUrl,
    inLanguage: SITE_LANGUAGE,
    publisher: createSchemaReference(person['@id']),
  };

  return escapeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [person, website],
  });
}

export function createPostJsonLd(post: Post): string {
  const homeUrl = createAbsoluteUrl('/');
  const url = createAbsoluteUrl(`/posts/${post.slug}`);
  const publishedTime = getPostPublishedDateTime(post);
  const image = createAbsoluteUrl(post.coverImage ?? `/posts/${post.slug}/opengraph-image`);
  const author = createAuthorSchema();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}${ARTICLE_ID_SUFFIX}`,
    headline: post.title,
    description: createPostDescription({ description: post.description, content: post.content }),
    datePublished: publishedTime,
    dateModified: publishedTime,
    image,
    url,
    inLanguage: SITE_LANGUAGE,
    isPartOf: createSchemaReference(`${homeUrl}${WEBSITE_ID_SUFFIX}`),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author,
    publisher: author,
    keywords: post.tags,
  };

  return escapeJsonLd(jsonLd);
}

export function createPostBreadcrumbJsonLd(post: Pick<Post, 'slug' | 'title'>): string {
  const url = createAbsoluteUrl(`/posts/${post.slug}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      createListItem({ position: 1, name: SITE_NAME, item: createAbsoluteUrl('/') }),
      createListItem({
        position: 2,
        name: 'Posts',
        item: createAbsoluteUrl('/posts'),
      }),
      createListItem({ position: 3, name: post.title, item: url }),
    ],
  };

  return escapeJsonLd(jsonLd);
}

function createAuthorSchema(): SchemaPerson {
  return {
    '@type': 'Person',
    '@id': createAbsoluteUrl(PERSON_ID_PATH),
    name: SITE_AUTHOR_NAME,
    url: SITE_AUTHOR_URL,
  };
}

function createSchemaReference(id: string): SchemaReference {
  return {
    '@id': id,
  };
}

function createListItem({ position, name, item }: Omit<SchemaListItem, '@type'>): SchemaListItem {
  return {
    '@type': 'ListItem',
    position,
    name,
    item,
  };
}

function escapeJsonLd(jsonLd: object): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}
