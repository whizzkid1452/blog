import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SidebarSearchForm } from './sidebar-search-form';

describe('SidebarSearchForm', () => {
  it('submits a Korean search query to the localized search page', () => {
    const markup = renderToStaticMarkup(<SidebarSearchForm locale="ko" />);

    expect(markup).toContain('role="search"');
    expect(markup).toContain('action="/search"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('placeholder="글 검색"');
  });

  it('submits an English search query to the localized search page', () => {
    const markup = renderToStaticMarkup(<SidebarSearchForm locale="en" />);

    expect(markup).toContain('action="/en/search"');
    expect(markup).toContain('placeholder="Search posts"');
  });
});
