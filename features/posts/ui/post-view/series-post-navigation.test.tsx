import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SeriesPostNavigation } from './series-post-navigation';

describe('SeriesPostNavigation', () => {
  it('links to the series collection and adjacent posts', () => {
    const markup = renderToStaticMarkup(
      <SeriesPostNavigation
        navigation={{
          name: 'TypeScript DAW 엔진 구현기',
          previousPost: createPostSummary('previous-post', '이전 시리즈 글'),
          nextPost: createPostSummary('next-post', '다음 시리즈 글'),
        }}
      />
    );

    expect(markup).toContain('href="/series#TypeScript%20DAW%20%EC%97%94%EC%A7%84%20%EA%B5%AC%ED%98%84%EA%B8%B0"');
    expect(markup).toContain('시리즈 바로가기');
    expect(markup).toContain('href="/posts/previous-post"');
    expect(markup).toContain('이전 글');
    expect(markup).toContain('href="/posts/next-post"');
    expect(markup).toContain('다음 글');
  });

  it('does not render a missing adjacent post link', () => {
    const markup = renderToStaticMarkup(
      <SeriesPostNavigation
        navigation={{
          name: 'Series',
          nextPost: createPostSummary('next-post', '다음 시리즈 글'),
        }}
      />
    );

    expect(markup).not.toContain('이전 글');
    expect(markup).toContain('다음 글');
  });
});

function createPostSummary(slug: string, title: string) {
  return {
    slug,
    title,
    date: '2026-08-13',
    tags: ['series'],
    visibility: 'public' as const,
  };
}
