import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync(new URL('../../../../app/styles/motion.css', import.meta.url), 'utf8');
const layoutStyles = readFileSync(new URL('./mobile-navigation-dialog.module.css', import.meta.url), 'utf8');
const mobileNavigationDialog = readFileSync(new URL('./mobile-navigation-dialog.tsx', import.meta.url), 'utf8');
const mobileNavigationContentStyles = layoutStyles.match(/\.mobileNavigationContent\s*{([^}]*)}/)?.[1] ?? '';

describe('mobile navigation direction', () => {
  it('positions the menu on the left and animates it from the left edge', () => {
    expect(mobileNavigationContentStyles).toContain('left: 0;');
    expect(mobileNavigationContentStyles).not.toContain('right: 0;');
    expect(mobileNavigationContentStyles).not.toContain('border-left:');
    expect(mobileNavigationContentStyles).not.toContain('border-right:');
    expect(mobileNavigationDialog).toContain('data-motion-overlay="left-drawer"');
    expect(globalStyles).toMatch(/\[data-motion-overlay='left-drawer'\][\s\S]*?motion-left-drawer-enter/);
    expect(globalStyles).toMatch(/@keyframes motion-left-drawer-enter\s*{[\s\S]*?translateX\(-100%\)/);
  });
});
