import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteNavigationContent } from './site-navigation-content';

describe('SiteNavigationContent', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('renders the complete navigation content shared by desktop and mobile layouts', () => {
    const markup = renderToStaticMarkup(
      <SiteNavigationContent
        locale="ko"
        githubProfileUrl="https://github.com/example"
        resumeUrl="https://example.com/about"
        tags={['react']}
      />
    );

    expect(markup).toContain('profile-avatar.png');
    expect(markup).toContain('href="/posts"');
    expect(markup).toContain('href="/series">시리즈</a>');
    expect(markup).not.toContain('href="/til"');
    expect(markup).not.toContain('TIL');
    expect(markup).toContain('>GitHub</a>');
    expect(markup).toContain('>About</a>');
    expect(markup).not.toContain('/auth/login');
    expect(markup).not.toContain('>English</a>');
    expect(markup).toContain('role="search"');
    expect(markup).toContain('>주제</h2>');
    expect(markup).toContain('href="/tags/react"');
    expect(markup).not.toContain('>최근 글</h2>');
    expect(markup).not.toContain('href="/posts/example"');
  });
  it('shows the TIL board in production without a local preview flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_TIL_LOCAL_PREVIEW', undefined);
    vi.resetModules();

    const { SiteNavigationContent: ProductionNavigation } = await import('./site-navigation-content');
    const markup = renderToStaticMarkup(
      <ProductionNavigation
        locale="ko"
        githubProfileUrl="https://github.com/example"
        resumeUrl="https://example.com/about"
        tags={[]}
      />
    );

    expect(markup).toContain('href="/til"');
    expect(markup).toContain('TIL');
    expect(markup).toContain('href="/series"');
  });
});
