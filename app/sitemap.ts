import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { createSitemap } from '@/features/posts/seo/sitemap';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const postIndex = getPostIndex();
  const englishPostIndex = getPostIndexForLocale('en');

  return createSitemap({
    posts: postIndex.getPostSummaries(),
    tags: postIndex.getTags(),
    englishPosts: englishPostIndex.getPostSummaries(),
    englishTags: englishPostIndex.getTags(),
  });
}
