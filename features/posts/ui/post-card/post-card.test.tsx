import type { PostSummary } from '../../model/post';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PostCard } from './post-card';

const post: PostSummary = {
  slug: 'react-rendering',
  title: 'React rendering',
  description: 'React rendering flow',
  date: '2026-07-16',
  tags: ['react'],
  visibility: 'public',
};

describe('PostCard', () => {
  it('renders the post thumbnail', () => {
    const markup = renderToStaticMarkup(
      <PostCard post={{ ...post, thumbnail: { src: '/images/content.png', alt: 'Content diagram' } }} />
    );
    const decodedMarkup = decodeURIComponent(markup);

    expect(decodedMarkup).toContain('url=/images/content.png');
    expect(markup).toContain('alt="Content diagram"');
  });

  it('renders only the text content when the post has no thumbnail', () => {
    const markup = renderToStaticMarkup(<PostCard locale="en" post={post} />);
    const decodedMarkup = decodeURIComponent(markup);

    expect(decodedMarkup).not.toContain('/preview-image');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('React rendering');
  });

  it('renders an external post thumbnail without the Next.js image optimizer', () => {
    const markup = renderToStaticMarkup(
      <PostCard post={{ ...post, thumbnail: { src: 'https://example.com/content.png', alt: 'External image' } }} />
    );

    expect(markup).toContain('src="https://example.com/content.png"');
    expect(markup).not.toContain('/_next/image');
  });
});
