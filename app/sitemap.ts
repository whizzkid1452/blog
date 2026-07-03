import { getPostPublishedDateTime, getPostSummaries, getTags } from '@/lib/posts';
import { createAbsoluteUrl } from '@/lib/site-config';
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: createAbsoluteUrl('/'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: createAbsoluteUrl('/posts'),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  const postRoutes = getPostSummaries().map(post => ({
    url: createAbsoluteUrl(`/posts/${post.slug}`),
    lastModified: new Date(getPostPublishedDateTime(post)),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const tagRoutes = getTags().map(tag => ({
    url: createAbsoluteUrl(`/tags/${encodeURIComponent(tag)}`),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...tagRoutes];
}
