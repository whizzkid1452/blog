import { getPostSummaries } from '@/lib/posts';
import { createRssFeed } from '@/lib/rss';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(createRssFeed(getPostSummaries()), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
