import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const markdownContentStyles = readFileSync(new URL('./markdown/markdown-content.module.css', import.meta.url), 'utf8');
const postViewStyles = readFileSync(new URL('./post-view.module.css', import.meta.url), 'utf8');

describe('post table of contents layout', () => {
  it('keeps table-of-contents headings below the fixed site header', () => {
    const headingRule = getCssRule(
      markdownContentStyles,
      ['.content h1', '.content h2', '.content h3', '.content h4'].join(',\n')
    );

    expect(headingRule).toContain('scroll-margin-top: var(--site-header-height);');
  });

  it('places the desktop table of contents in a fixed right rail', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('position: fixed;');
    expect(navigationRule).toContain('right: 0;');
    expect(navigationRule).toContain('width: var(--desktop-table-of-contents-width);');
  });

  it('keeps the desktop table-of-contents divider transparent', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('border-left: 1px solid transparent;');
  });

  it('keeps the desktop table of contents scrollable without showing a scrollbar', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation');
    const webkitScrollbarRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation::-webkit-scrollbar');

    expect(navigationRule).toContain('overflow-y: auto;');
    expect(navigationRule).toContain('scrollbar-color: transparent transparent;');
    expect(navigationRule).toContain('scrollbar-width: none;');
    expect(webkitScrollbarRule).toContain('width: 0;');
    expect(webkitScrollbarRule).toContain('height: 0;');
  });

  it('keeps the desktop table of contents below the fixed site header', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('padding: var(--site-content-top-padding) 24px 72px;');
  });

  it('keeps the mobile table of contents scrollable without showing a scrollbar', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.mobileTableOfContentsContent');
    const webkitScrollbarRule = getCssRule(markdownContentStyles, '.mobileTableOfContentsContent::-webkit-scrollbar');

    expect(navigationRule).toContain('overflow-y: auto;');
    expect(navigationRule).toContain('scrollbar-color: transparent transparent;');
    expect(navigationRule).toContain('scrollbar-width: none;');
    expect(webkitScrollbarRule).toContain('width: 0;');
    expect(webkitScrollbarRule).toContain('height: 0;');
  });

  it('reserves the right rail outside the post content width', () => {
    const pageShellRule = getCssRule(postViewStyles, ".pageShell[data-has-table-of-contents='true']");

    expect(pageShellRule).toContain('--desktop-table-of-contents-width: 280px;');
    expect(pageShellRule).toContain('--desktop-table-of-contents-content-offset: -140px;');
    expect(pageShellRule).toContain('width: min(calc(100% - var(--desktop-table-of-contents-width)), 720px);');
    expect(pageShellRule).toContain('inset-inline-start: var(--desktop-table-of-contents-content-offset);');
  });
});

describe('markdown image dialog layout', () => {
  it('keeps the dialog content boundary on the image so Radix can dismiss outside clicks', () => {
    const dialogContentRule = getCssRule(markdownContentStyles, '.markdownImageZoomContent');

    expect(dialogContentRule).toContain('top: 50%;');
    expect(dialogContentRule).toContain('left: 50%;');
    expect(dialogContentRule).not.toContain('inset: 0;');
  });
});

function getCssRule(styleSheet: string, selector: string): string {
  const ruleStart = styleSheet.indexOf(`${selector} {`);
  const ruleEnd = styleSheet.indexOf('}', ruleStart);

  if (ruleStart === -1 || ruleEnd === -1) {
    return '';
  }

  return styleSheet.slice(ruleStart, ruleEnd + 1);
}
