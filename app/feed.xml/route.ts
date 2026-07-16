import { getPostIndex } from '@/features/posts/server/post-repository';
import { createRssFeed } from '@/features/posts/seo/rss';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(createRssFeed(getPostIndex().getPostSummaries()), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
