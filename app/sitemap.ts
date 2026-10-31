import { getPostIndex } from '@/features/posts/server/post-repository';
import { createSitemap } from '@/features/posts/seo/sitemap';
import type { MetadataRoute } from 'next';
import { getStudySummaries } from '@/features/til/server/study-repository';
import { createAbsoluteUrl } from '@/shared/config/site-config';
import { IS_TIL_PUBLISHED } from '@/features/til/config/til-publication';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const postIndex = getPostIndex();
  const postRoutes = createSitemap({
    posts: postIndex.getPostSummaries(),
    tags: postIndex.getTags(),
  });
  if (!IS_TIL_PUBLISHED) return postRoutes;
  return [
    ...postRoutes,
    { url: createAbsoluteUrl('/til'), changeFrequency: 'daily', priority: 0.7 },
    ...getStudySummaries().map(entry => ({
      url: createAbsoluteUrl(`/til/${entry.date}`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
