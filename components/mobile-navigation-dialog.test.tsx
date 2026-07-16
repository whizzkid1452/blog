import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileNavigationTopics } from './mobile-navigation-dialog';

describe('MobileNavigationTopics', () => {
  it('renders portfolio topics and keeps additional topics collapsed by default', () => {
    const markup = renderToStaticMarkup(
      <MobileNavigationTopics
        locale="ko"
        tags={['nextjs', 'drag', 'react', 'performance', 'architecture']}
        onNavigate={() => undefined}
      />
    );

    expect(markup).toContain('data-state="closed"');
    expect(markup).toContain('href="/tags/performance"');
    expect(markup).toContain('href="/tags/architecture"');
    expect(markup).toContain('href="/tags/react"');
    expect(markup).toContain('전체보기');
    expect(markup).not.toContain('href="/tags/nextjs"');
    expect(markup).not.toContain('href="/tags/drag"');
  });

  it('does not render the expand button when every topic is a portfolio topic', () => {
    const markup = renderToStaticMarkup(
      <MobileNavigationTopics locale="ko" tags={['react', 'performance']} onNavigate={() => undefined} />
    );

    expect(markup).not.toContain('전체보기');
  });
});
