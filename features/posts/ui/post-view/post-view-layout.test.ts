import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const markdownContentStyles = readFileSync(new URL('./markdown/markdown-content.module.css', import.meta.url), 'utf8');
const postViewStyles = readFileSync(new URL('./post-view.module.css', import.meta.url), 'utf8');

describe('post table of contents layout', () => {
  it('places the desktop table of contents in a fixed right rail', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('position: fixed;');
    expect(navigationRule).toContain('right: 0;');
    expect(navigationRule).toContain('width: var(--desktop-table-of-contents-width);');
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

  it('uses a valid top padding after the desktop header is removed', () => {
    const navigationRule = getCssRule(markdownContentStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('padding: 56px 24px 72px;');
    expect(navigationRule).not.toContain('var(--desktop-header-height)');
  });

  it('reserves the right rail outside the post content width', () => {
    const pageShellRule = getCssRule(postViewStyles, ".pageShell[data-has-table-of-contents='true']");

    expect(pageShellRule).toContain('--desktop-table-of-contents-width: 280px;');
    expect(pageShellRule).toContain('--desktop-table-of-contents-content-offset: -140px;');
    expect(pageShellRule).toContain('width: min(calc(100% - var(--desktop-table-of-contents-width)), 720px);');
    expect(pageShellRule).toContain('inset-inline-start: var(--desktop-table-of-contents-content-offset);');
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
