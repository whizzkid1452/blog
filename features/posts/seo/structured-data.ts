import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getContentLanguage } from '@/shared/i18n/i18n';
import {
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_NAME,
  createAbsoluteUrl,
  getSiteDescription,
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

export function createSiteJsonLd(locale: Locale = 'ko'): string {
  const person = createAuthorSchema();
  const homeUrl = createAbsoluteUrl(createLocalizedPath(locale, '/'));
  const website = {
    '@type': 'WebSite',
    '@id': `${homeUrl}${WEBSITE_ID_SUFFIX}`,
    name: SITE_NAME,
    description: getSiteDescription(locale),
    url: homeUrl,
    inLanguage: getContentLanguage(locale),
    publisher: createSchemaReference(person['@id']),
  };

  return escapeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [person, website],
  });
}

export function createPostJsonLd(post: Post, locale: Locale = 'ko'): string {
  const homeUrl = createAbsoluteUrl(createLocalizedPath(locale, '/'));
  const url = createAbsoluteUrl(createLocalizedPath(locale, `/posts/${post.slug}`));
  const publishedTime = getPostPublishedDateTime(post);
  const image = createAbsoluteUrl(
    post.coverImage ?? createLocalizedPath(locale, `/posts/${post.slug}/opengraph-image`)
  );
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
    inLanguage: getContentLanguage(locale),
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

export function createPostBreadcrumbJsonLd(post: Pick<Post, 'slug' | 'title'>, locale: Locale = 'ko'): string {
  const url = createAbsoluteUrl(createLocalizedPath(locale, `/posts/${post.slug}`));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      createListItem({ position: 1, name: SITE_NAME, item: createAbsoluteUrl(createLocalizedPath(locale, '/')) }),
      createListItem({
        position: 2,
        name: 'Posts',
        item: createAbsoluteUrl(createLocalizedPath(locale, '/posts')),
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
