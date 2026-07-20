import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutStyles = [
  readFileSync(new URL('./site-layout.module.css', import.meta.url), 'utf8'),
  readFileSync(new URL('./mobile-navigation-dialog.module.css', import.meta.url), 'utf8'),
].join('\n');

describe('site header styles', () => {
  it('uses a compact width for the desktop sidebar', () => {
    const siteShellRule = getCssRules(layoutStyles, '.siteShell')[0] ?? '';

    expect(siteShellRule).toContain('--desktop-sidebar-width: 300px;');
  });

  it('keeps the desktop sidebar divider transparent', () => {
    const desktopSidebarRule = getCssRules(layoutStyles, '.sidebar')[0] ?? '';

    expect(desktopSidebarRule).toContain('border-right: 1px solid transparent;');
  });

  it('shows the header beside the desktop sidebar without a border', () => {
    const siteHeaderRules = getCssRules(layoutStyles, '.siteHeader');
    const desktopHeaderRule = siteHeaderRules[0] ?? '';

    expect(desktopHeaderRule).toContain('display: grid;');
    expect(desktopHeaderRule).toContain('left: var(--desktop-sidebar-width);');
    expect(desktopHeaderRule).toContain('height: var(--site-header-height);');
    expect(siteHeaderRules.every(rule => !rule.includes('border'))).toBe(true);
  });

  it('removes the shadow from the liquid glass header', () => {
    const glassHeaderRule = getCssRules(layoutStyles, ".siteHeader[data-liquid-glass='bar']")[0] ?? '';

    expect(glassHeaderRule).toContain('box-shadow: none;');
  });

  it('moves the header outside the viewport until the scroll threshold is reached', () => {
    const hiddenHeaderRule = getCssRules(layoutStyles, '.siteHeader')[0] ?? '';
    const visibleHeaderRule = getCssRules(layoutStyles, ".siteHeader[data-site-header-visible='true']")[0] ?? '';

    expect(hiddenHeaderRule).toContain('opacity: 0;');
    expect(hiddenHeaderRule).toContain('pointer-events: none;');
    expect(hiddenHeaderRule).toContain('transform: translateY(-100%);');
    expect(visibleHeaderRule).toContain('opacity: 1;');
    expect(visibleHeaderRule).toContain('pointer-events: auto;');
    expect(visibleHeaderRule).toContain('transform: translateY(0);');
  });

  it('uses a slower duration when the header enters the viewport', () => {
    const siteShellRule = getCssRules(layoutStyles, '.siteShell')[0] ?? '';
    const visibleHeaderRule = getCssRules(layoutStyles, ".siteHeader[data-site-header-visible='true']")[0] ?? '';

    expect(siteShellRule).toContain('--site-header-enter-duration: 400ms;');
    expect(visibleHeaderRule).toContain('transition-duration: var(--site-header-enter-duration);');
  });

  it('reserves vertical space for the fixed header above desktop content', () => {
    const mainContentRule = getCssRules(layoutStyles, '.mainContent')[0] ?? '';

    expect(mainContentRule).toContain('padding: var(--site-content-top-padding) 24px 72px 56px;');
  });

  it('keeps the mobile navigation scrollable without showing a scrollbar', () => {
    const mobileNavigationRule = getCssRules(layoutStyles, '.mobileNavigationContent')[0] ?? '';
    const webkitScrollbarRule = getCssRules(layoutStyles, '.mobileNavigationContent::-webkit-scrollbar')[0] ?? '';

    expect(mobileNavigationRule).toContain('overflow-y: auto;');
    expect(mobileNavigationRule).toContain('scrollbar-color: transparent transparent;');
    expect(mobileNavigationRule).toContain('scrollbar-width: none;');
    expect(webkitScrollbarRule).toContain('width: 0;');
    expect(webkitScrollbarRule).toContain('height: 0;');
  });
});

function getCssRules(styleSheet: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Array.from(styleSheet.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)}`, 'g')), match => match[1]);
}
