import { createAbsoluteUrl, getSiteUrl } from '@/lib/site-config';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: createAbsoluteUrl('/sitemap.xml'),
    host: getSiteUrl().origin,
  };
}
