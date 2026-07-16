import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SidebarTopicsSection } from './sidebar-topics-section';

describe('SidebarTopicsSection', () => {
  it('renders portfolio topics and keeps additional topics collapsed by default', () => {
    const markup = renderToStaticMarkup(
      <SidebarTopicsSection tags={['nextjs', 'drag', 'react', 'performance', 'architecture']} />
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
    const markup = renderToStaticMarkup(<SidebarTopicsSection tags={['react', 'performance']} />);

    expect(markup).not.toContain('전체보기');
  });
});
