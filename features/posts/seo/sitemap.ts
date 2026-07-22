import type { MetadataRoute } from 'next';
import { createAbsoluteUrl } from '@/shared/config/site-config';
import { getPostPublishedDateTime } from '../server/post-repository';
import type { PostSummary } from '../model/post';

interface CreateSitemapParams {
  posts: PostSummary[];
  tags: string[];
}

export function createSitemap({ posts, tags }: CreateSitemapParams): MetadataRoute.Sitemap {
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
    {
      url: createAbsoluteUrl('/series'),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  const postRoutes = posts.map(post => ({
    url: createAbsoluteUrl(`/posts/${post.slug}`),
    lastModified: new Date(getPostPublishedDateTime(post)),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const tagRoutes = tags.map(tag => ({
    url: createAbsoluteUrl(`/tags/${encodeURIComponent(tag)}`),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...tagRoutes];
}
