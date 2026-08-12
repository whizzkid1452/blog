import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SidebarTopicsSection } from './sidebar-topics-section';

describe('SidebarTopicsSection', () => {
  it('renders only the curated portfolio topics', () => {
    const markup = renderToStaticMarkup(
      <SidebarTopicsSection tags={['nextjs', 'drag', 'react', 'performance', 'architecture']} />
    );

    expect(markup).toContain('href="/tags/performance"');
    expect(markup).toContain('href="/tags/architecture"');
    expect(markup).toContain('href="/tags/react"');
    expect(markup).not.toContain('href="/tags/nextjs"');
    expect(markup).not.toContain('href="/tags/drag"');
    expect(markup).not.toContain('data-state=');
  });
});
