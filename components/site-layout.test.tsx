import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './site-layout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('SiteLayout', () => {
  it('renders primary navigation inside the left sidebar without a top header', () => {
    const markup = renderToStaticMarkup(
      <SiteLayout
        locale="ko"
        tags={['react']}
        recentPosts={[{ slug: 'example', title: 'Example post', date: '2026-07-16', tags: ['react'] }]}
      >
        <p>Content</p>
      </SiteLayout>
    );
    const sidebarMarkup = markup.slice(markup.indexOf('<aside'), markup.indexOf('</aside>'));

    expect(markup).not.toContain('<header');
    expect(sidebarMarkup).toContain('>Blog</a>');
    expect(sidebarMarkup).toContain('>홈</a>');
    expect(sidebarMarkup).toContain('>GitHub</a>');
    expect(sidebarMarkup).toContain('>About</a>');
    expect(sidebarMarkup).toContain('>English</a>');
    expect(sidebarMarkup.indexOf('>Blog</a>')).toBeLessThan(sidebarMarkup.indexOf('>주제<'));
  });
});
