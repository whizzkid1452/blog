import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

const markdownContentStyles = readFileSync(new URL('./markdown-content.module.css', import.meta.url), 'utf8');
const mainProcessSsotSlug = 'electron-multi-window-shared-data-ssot';

describe('markdown article layout', () => {
  it('exposes the post slug so article-specific styles remain scoped', async () => {
    const markdownElement = await MarkdownContent({
      content: '본문',
      postSlug: mainProcessSsotSlug,
    });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain(`data-post-slug="${mainProcessSsotSlug}"`);
  });

  it('centers and separates the Main Process SSOT images and captions', () => {
    expect(markdownContentStyles).toContain(`.content[data-post-slug='${mainProcessSsotSlug}']`);
    expect(markdownContentStyles).toContain('width: min(100%, 440px);');
    expect(markdownContentStyles).toContain('margin-inline: auto;');
    expect(markdownContentStyles).toContain('margin: 64px 0 0;');
    expect(markdownContentStyles).toContain('margin: 4px auto 64px;');
    expect(markdownContentStyles).toContain('font-size: 14px;');
    expect(markdownContentStyles).toContain('text-align: center;');
    expect(markdownContentStyles).toContain('margin-top: 68px;');
    expect(markdownContentStyles).toContain('margin-top: 60px;');
  });
});
