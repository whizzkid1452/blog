import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './site-layout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('SiteLayout', () => {
  it('renders a profile-led information hierarchy inside the left sidebar', () => {
    const markup = renderToStaticMarkup(
      <SiteLayout
        locale="ko"
        tags={['react']}
        recentPosts={[
          { slug: 'example', title: 'Example post', date: '2026-07-16', tags: ['react'], visibility: 'public' },
        ]}
      >
        <p>Content</p>
      </SiteLayout>
    );
    const sidebarMarkup = markup.slice(markup.indexOf('<aside'), markup.indexOf('</aside>'));

    expect(markup).not.toContain('<header');
    expect(sidebarMarkup).not.toContain('>Blog</a>');
    expect(sidebarMarkup).toContain('profile-avatar.png');
    expect(sidebarMarkup).toContain('>앨리스의 토끼굴</p>');
    expect(sidebarMarkup).toContain('>@whizzkid1452</p>');
    expect(sidebarMarkup).toContain('>블로그 메뉴</h2>');
    expect(sidebarMarkup).toContain('>홈</a>');
    expect(sidebarMarkup).toContain('>GitHub</a>');
    expect(sidebarMarkup).toContain('>About</a>');
    expect(sidebarMarkup).toContain('>English</a>');
    expect(sidebarMarkup.indexOf('>GitHub</a>')).toBeLessThan(sidebarMarkup.indexOf('>홈</a>'));
    expect(sidebarMarkup.indexOf('>About</a>')).toBeLessThan(sidebarMarkup.indexOf('>홈</a>'));
    expect(sidebarMarkup.indexOf('>English</a>')).toBeLessThan(sidebarMarkup.indexOf('>홈</a>'));
    expect(sidebarMarkup.indexOf('>홈</a>')).toBeLessThan(sidebarMarkup.indexOf('>주제<'));
    expect(sidebarMarkup.indexOf('>앨리스의 토끼굴</p>')).toBeLessThan(sidebarMarkup.indexOf('>블로그 메뉴</h2>'));
    expect(sidebarMarkup.indexOf('>블로그 메뉴</h2>')).toBeLessThan(sidebarMarkup.indexOf('>검색</h2>'));
    expect(sidebarMarkup.indexOf('>검색</h2>')).toBeLessThan(sidebarMarkup.indexOf('>주제</h2>'));
    expect(sidebarMarkup.indexOf('>주제</h2>')).toBeLessThan(sidebarMarkup.indexOf('>최근 글</h2>'));
  });
});
