import { getPostPublishedDateTime, getPostSummaries } from '@/lib/posts';
import { RSS_FEED_PATH, SITE_DESCRIPTION, SITE_NAME, createAbsoluteUrl } from '@/lib/site-config';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(createRssFeed(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}

function createRssFeed(): string {
  const posts = getPostSummaries();
  const latestPost = posts[0];
  const lastBuildDate = latestPost == null ? new Date().toUTCString() : toRssDate(getPostPublishedDateTime(latestPost));
  const items = posts.map(createRssItem).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${escapeXml(SITE_NAME)}</title>`,
    `<link>${escapeXml(createAbsoluteUrl('/'))}</link>`,
    `<description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    `<language>ko-KR</language>`,
    `<lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `<atom:link href="${escapeXml(createAbsoluteUrl(RSS_FEED_PATH))}" rel="self" type="application/rss+xml" />`,
    items,
    '</channel>',
    '</rss>',
  ].join('');
}

function createRssItem(post: ReturnType<typeof getPostSummaries>[number]): string {
  const url = createAbsoluteUrl(`/posts/${post.slug}`);

  return [
    '<item>',
    `<title>${escapeXml(post.title)}</title>`,
    `<link>${escapeXml(url)}</link>`,
    `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `<pubDate>${toRssDate(getPostPublishedDateTime(post))}</pubDate>`,
    `<description>${escapeXml(post.description ?? '')}</description>`,
    '</item>',
  ].join('');
}

function toRssDate(value: string): string {
  return new Date(value).toUTCString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
