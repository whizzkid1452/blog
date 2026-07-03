import { describe, expect, it } from 'vitest';
import type { PostSummary } from './posts';
import { createRssFeed } from './rss';

describe('createRssFeed', () => {
  it('escapes XML-sensitive characters in feed text fields', () => {
    const posts: PostSummary[] = [
      {
        slug: 'xml-characters',
        title: 'A & B <C> "quoted"',
        description: "Reader's guide & notes",
        date: '2026-07-03',
        publishedAt: '2026-07-03T12:30:00.000Z',
        tags: ['nextjs', 'rss'],
      },
    ];

    const feed = createRssFeed(posts);

    expect(feed).toContain('A &amp; B &lt;C&gt; &quot;quoted&quot;');
    expect(feed).toContain('Reader&apos;s guide &amp; notes');
    expect(feed).toContain('<category>nextjs</category>');
    expect(feed).toContain('<pubDate>Fri, 03 Jul 2026 12:30:00 GMT</pubDate>');
  });

  it('uses the newest post date as the channel build date', () => {
    const posts: PostSummary[] = [
      {
        slug: 'newer-post',
        title: 'Newer post',
        date: '2026-07-03',
        publishedAt: '2026-07-03T09:00:00.000Z',
        tags: ['nextjs'],
      },
      {
        slug: 'older-post',
        title: 'Older post',
        date: '2026-07-02',
        publishedAt: '2026-07-02T09:00:00.000Z',
        tags: ['nextjs'],
      },
    ];

    const feed = createRssFeed(posts);

    expect(feed).toContain('<lastBuildDate>Fri, 03 Jul 2026 09:00:00 GMT</lastBuildDate>');
  });
});
