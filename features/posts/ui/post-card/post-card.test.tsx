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
  it('renders the localized generated preview when a cover image is not provided', () => {
    const markup = renderToStaticMarkup(<PostCard locale="en" post={post} />);
    const decodedMarkup = decodeURIComponent(markup);

    expect(decodedMarkup).toContain('url=/en/posts/react-rendering/preview-image');
    expect(markup).toContain('alt=""');
  });

  it('does not expose a generated preview path for an authenticated post', () => {
    const markup = renderToStaticMarkup(<PostCard post={{ ...post, visibility: 'authenticated' }} />);
    const decodedMarkup = decodeURIComponent(markup);

    expect(decodedMarkup).toContain('src="/og-default.svg"');
    expect(decodedMarkup).not.toContain('/posts/react-rendering/preview-image');
  });

  it('renders the configured cover image and alternative text', () => {
    const markup = renderToStaticMarkup(
      <PostCard
        post={{ ...post, coverImage: '/images/react-rendering.png', coverAlt: 'React rendering flow diagram' }}
      />
    );
    const decodedMarkup = decodeURIComponent(markup);

    expect(decodedMarkup).toContain('url=/images/react-rendering.png');
    expect(markup).toContain('alt="React rendering flow diagram"');
  });
});
