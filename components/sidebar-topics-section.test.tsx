import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SidebarTopicsSection } from './sidebar-topics-section';

describe('SidebarTopicsSection', () => {
  it('renders topics collapsed by default', () => {
    const markup = renderToStaticMarkup(<SidebarTopicsSection tags={['react', 'nextjs']} />);

    expect(markup).toContain('data-state="closed"');
    expect(markup).not.toContain('href="/tags/react"');
  });
});
