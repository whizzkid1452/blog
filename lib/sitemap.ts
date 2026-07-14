import type { MetadataRoute } from 'next';
import type { Locale } from './i18n';
import { createLocalizedPath } from './i18n';
import { getPostPublishedDateTime } from './posts';
import type { PostSummary } from './posts';
import { createAbsoluteUrl } from './site-config';

interface CreateSitemapParams {
  posts: PostSummary[];
  tags: string[];
  englishPosts?: PostSummary[];
  englishTags?: string[];
}

export function createSitemap({
  posts,
  tags,
  englishPosts = [],
  englishTags = [],
}: CreateSitemapParams): MetadataRoute.Sitemap {
  const englishPostSlugs = new Set(englishPosts.map(post => post.slug));
  const englishTagSet = new Set(englishTags);
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: createAbsoluteUrl('/'),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: createLanguageAlternates('/'),
    },
    {
      url: createAbsoluteUrl('/posts'),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: createLanguageAlternates('/posts'),
    },
    {
      url: createAbsoluteUrl('/en'),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: createLanguageAlternates('/'),
    },
    {
      url: createAbsoluteUrl('/en/posts'),
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: createLanguageAlternates('/posts'),
    },
  ];

  const postRoutes = posts.map(post => ({
    url: createAbsoluteUrl(`/posts/${post.slug}`),
    lastModified: new Date(getPostPublishedDateTime(post)),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
    alternates: englishPostSlugs.has(post.slug) ? createLanguageAlternates(`/posts/${post.slug}`) : undefined,
  }));

  const englishPostRoutes = englishPosts.map(post => ({
    url: createAbsoluteUrl(createLocalizedPath('en', `/posts/${post.slug}`)),
    lastModified: new Date(getPostPublishedDateTime(post)),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
    alternates: createLanguageAlternates(`/posts/${post.slug}`),
  }));

  const tagRoutes = tags.map(tag => ({
    url: createAbsoluteUrl(`/tags/${encodeURIComponent(tag)}`),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
    alternates: englishTagSet.has(tag) ? createLanguageAlternates(`/tags/${encodeURIComponent(tag)}`) : undefined,
  }));

  const englishTagRoutes = englishTags.map(tag => ({
    url: createAbsoluteUrl(createLocalizedPath('en', `/tags/${encodeURIComponent(tag)}`)),
    changeFrequency: 'weekly' as const,
    priority: 0.4,
    alternates: createLanguageAlternates(`/tags/${encodeURIComponent(tag)}`),
  }));

  return [...staticRoutes, ...postRoutes, ...englishPostRoutes, ...tagRoutes, ...englishTagRoutes];
}

function createLanguageAlternates(pathname: string): { languages: Record<string, string> } {
  return {
    languages: {
      'ko-KR': createLocaleUrl('ko', pathname),
      'en-US': createLocaleUrl('en', pathname),
    },
  };
}

function createLocaleUrl(locale: Locale, pathname: string): string {
  return createAbsoluteUrl(createLocalizedPath(locale, pathname));
}
