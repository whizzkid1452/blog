import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './site-layout';

const { currentPathname } = vi.hoisted(() => ({ currentPathname: { value: '/' } }));

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname.value,
}));

describe('SiteLayout', () => {
  it('모바일 헤더에 메뉴 트리거와 현재 페이지 제목을 표시한다', () => {
    currentPathname.value = '/';
    const markup = renderToStaticMarkup(
      <SiteLayout locale="ko" tags={[]} recentPosts={[]}>
        <p>Content</p>
      </SiteLayout>
    );

    expect(markup).toContain('aria-label="블로그 메뉴 열기"');
    expect(markup).toContain('data-site-header="true"');
    expect(markup).toContain('data-mobile-navigation-trigger="true"');
    expect(markup).toContain('data-liquid-glass="bar"');
    expect(markup).toContain('>앨리스의 토끼굴</p>');
  });

  it('글 페이지의 모바일 헤더에 글 제목을 표시한다', () => {
    currentPathname.value = '/posts/example';
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

    expect(markup).toContain('>Example post</p>');
  });

  it('기본 메뉴에 Series와 비공개 글 링크를 표시하지 않는다', () => {
    currentPathname.value = '/';
    const markup = renderToStaticMarkup(
      <SiteLayout locale="ko" tags={[]} recentPosts={[]}>
        <p>Content</p>
      </SiteLayout>
    );

    expect(markup).not.toContain('href="/series"');
    expect(markup).not.toContain('href="/private-posts"');
  });

  it('renders a profile-led information hierarchy inside the left sidebar', () => {
    currentPathname.value = '/';
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

    expect(sidebarMarkup).not.toContain('<header');
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
