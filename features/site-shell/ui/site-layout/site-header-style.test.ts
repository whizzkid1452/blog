import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutStyles = readFileSync(new URL('./site-layout.module.css', import.meta.url), 'utf8');

describe('site header styles', () => {
  it('uses a compact width for the desktop sidebar', () => {
    const siteShellRule = getCssRules(layoutStyles, '.siteShell')[0] ?? '';

    expect(siteShellRule).toContain('--desktop-sidebar-width: 300px;');
  });

  it('shows the header beside the desktop sidebar without a border', () => {
    const siteHeaderRules = getCssRules(layoutStyles, '.siteHeader');
    const desktopHeaderRule = siteHeaderRules[0] ?? '';

    expect(desktopHeaderRule).toContain('display: grid;');
    expect(desktopHeaderRule).toContain('left: var(--desktop-sidebar-width);');
    expect(desktopHeaderRule).toContain('height: var(--site-header-height);');
    expect(siteHeaderRules.every(rule => !rule.includes('border'))).toBe(true);
  });

  it('reserves vertical space for the fixed header above desktop content', () => {
    const mainContentRule = getCssRules(layoutStyles, '.mainContent')[0] ?? '';

    expect(mainContentRule).toContain('padding: var(--site-content-top-padding) 24px 72px 56px;');
  });
});

function getCssRules(styleSheet: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Array.from(styleSheet.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)}`, 'g')), match => match[1]);
}
