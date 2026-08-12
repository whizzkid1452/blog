import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteNavigationContent } from './site-navigation-content';

describe('SiteNavigationContent', () => {
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
    expect(markup).toContain('href="/series"');
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
});
