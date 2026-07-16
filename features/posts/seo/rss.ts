import { RSS_FEED_PATH, SITE_DESCRIPTION, SITE_NAME, createAbsoluteUrl } from '@/shared/config/site-config';
import type { PostSummary } from '../model/post';
import { getPostPublishedDateTime } from '../server/post-repository';

const RSS_LANGUAGE = 'ko-KR';
const RSS_CONTENT_TYPE = 'application/rss+xml';
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function createRssFeed(posts: PostSummary[]): string {
  const latestPost = posts[0];
  const lastBuildDate = latestPost == null ? null : toRssDate(getPostPublishedDateTime(latestPost));
  const lastBuildDateXml =
    lastBuildDate == null ? '' : `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>\n`;
  const items = posts.map(createRssItem).join('\n');

  return `${XML_DECLARATION}
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(createAbsoluteUrl('/'))}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>${RSS_LANGUAGE}</language>
${lastBuildDateXml}    <atom:link href="${escapeXml(createAbsoluteUrl(RSS_FEED_PATH))}" rel="self" type="${RSS_CONTENT_TYPE}" />
${items}
  </channel>
</rss>
`;
}

function createRssItem(post: PostSummary): string {
  const url = createAbsoluteUrl(`/posts/${post.slug}`);
  const descriptionXml =
    post.description == null ? '' : `      <description>${escapeXml(post.description)}</description>\n`;
  const categoriesXml = post.tags.map(tag => `      <category>${escapeXml(tag)}</category>`).join('\n');

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
${descriptionXml}      <pubDate>${escapeXml(toRssDate(getPostPublishedDateTime(post)))}</pubDate>
${categoriesXml}
    </item>`;
}

function toRssDate(value: string): string {
  return new Date(value).toUTCString();
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => XML_ENTITIES[character]);
}
