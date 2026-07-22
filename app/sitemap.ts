import { getPostIndex } from '@/features/posts/server/post-repository';
import { createSitemap } from '@/features/posts/seo/sitemap';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const postIndex = getPostIndex();
  return createSitemap({
    posts: postIndex.getPostSummaries(),
    tags: postIndex.getTags(),
  });
}
