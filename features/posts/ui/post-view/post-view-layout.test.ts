import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const markdownContentStyles = readFileSync(new URL('./markdown/markdown-content.module.css', import.meta.url), 'utf8');
const tableOfContentsStyles = readFileSync(
  new URL('./markdown/markdown-table-of-contents-navigation.module.css', import.meta.url),
  'utf8'
);
const markdownImageStyles = readFileSync(
  new URL('./markdown/markdown-image-viewer.module.css', import.meta.url),
  'utf8'
);
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
    const navigationRule = getCssRule(tableOfContentsStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('position: fixed;');
    expect(navigationRule).toContain('right: 0;');
    expect(navigationRule).toContain('width: var(--desktop-table-of-contents-width);');
  });

  it('keeps the desktop table-of-contents divider transparent', () => {
    const navigationRule = getCssRule(tableOfContentsStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('border-left: 1px solid transparent;');
  });

  it('keeps the desktop table of contents scrollable without showing a scrollbar', () => {
    const navigationRule = getCssRule(tableOfContentsStyles, '.tableOfContentsNavigation');
    const webkitScrollbarRule = getCssRule(tableOfContentsStyles, '.tableOfContentsNavigation::-webkit-scrollbar');

    expect(navigationRule).toContain('overflow-y: auto;');
    expect(navigationRule).toContain('scrollbar-color: transparent transparent;');
    expect(navigationRule).toContain('scrollbar-width: none;');
    expect(webkitScrollbarRule).toContain('width: 0;');
    expect(webkitScrollbarRule).toContain('height: 0;');
  });

  it('keeps the desktop table of contents below the fixed site header', () => {
    const navigationRule = getCssRule(tableOfContentsStyles, '.tableOfContentsNavigation');

    expect(navigationRule).toContain('padding: var(--site-content-top-padding) 24px 72px;');
  });

  it('keeps the mobile table of contents scrollable without showing a scrollbar', () => {
    const navigationRule = getCssRule(tableOfContentsStyles, '.mobileTableOfContentsContent');
    const webkitScrollbarRule = getCssRule(tableOfContentsStyles, '.mobileTableOfContentsContent::-webkit-scrollbar');

    expect(navigationRule).toContain('overflow-y: auto;');
    expect(navigationRule).toContain('scrollbar-color: transparent transparent;');
    expect(navigationRule).toContain('scrollbar-width: none;');
    expect(webkitScrollbarRule).toContain('width: 0;');
    expect(webkitScrollbarRule).toContain('height: 0;');
  });

  it('highlights table-of-contents links without adding an underline', () => {
    const linkRule = getCssRule(tableOfContentsStyles, '.tableOfContentsLink');
    const hoverLinkRule = getCssRule(tableOfContentsStyles, '.tableOfContentsLink:hover');

    expect(linkRule).toContain('--table-of-contents-highlight-duration: 320ms;');
    expect(linkRule).toContain('color var(--table-of-contents-highlight-duration) var(--motion-ease-out)');
    expect(linkRule).toContain('text-decoration: none;');
    expect(hoverLinkRule).not.toContain('text-decoration');
  });

  it('does not underline post tag links when hovered', () => {
    expect(postViewStyles).not.toContain('.tagLink:hover');
  });

  it('preserves table-of-contents active highlighting in the explicit dark theme', () => {
    const explicitDarkLinkRule = getCssRule(
      tableOfContentsStyles,
      ":global(html[data-theme='dark']) .tableOfContentsLink"
    );
    const activeLinkRule = getCssRule(tableOfContentsStyles, ".tableOfContentsLink[data-active='true']");

    expect(explicitDarkLinkRule).toContain('color: var(--color-text-primary);');
    expect(activeLinkRule).toContain('color: var(--color-link);');
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
    const dialogContentRule = getCssRule(markdownImageStyles, '.markdownImageZoomContent');

    expect(dialogContentRule).toContain('top: 50%;');
    expect(dialogContentRule).toContain('left: 50%;');
    expect(dialogContentRule).not.toContain('inset: 0;');
  });
});

describe('markdown blockquote presentation', () => {
  it('distinguishes key statements with a restrained Tistory-style box', () => {
    const blockquoteRule = getCssRule(markdownContentStyles, '.content blockquote');

    expect(blockquoteRule).toContain('border: 1px solid var(--color-border);');
    expect(blockquoteRule).toContain('padding: 21px 25px 20px;');
    expect(blockquoteRule).toContain('background: color-mix(in srgb, var(--color-border) 20%, var(--background));');
    expect(blockquoteRule).toContain('color: var(--color-text-secondary);');
    expect(blockquoteRule).toContain('font-size: 16px;');
    expect(blockquoteRule).toContain('font-weight: 400;');
    expect(blockquoteRule).not.toContain('box-shadow:');
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
