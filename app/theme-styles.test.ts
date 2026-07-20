import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync(new URL('./styles/theme.css', import.meta.url), 'utf8');

describe('explicit color themes', () => {
  it('uses the system dark theme only when no explicit theme is selected', () => {
    expect(globalStyles).toContain(':root:not([data-theme])');
  });

  it('provides explicit light and dark color schemes', () => {
    const lightThemeRule = getCssRule(globalStyles, ":root[data-theme='light']");
    const darkThemeRule = getCssRule(globalStyles, ":root[data-theme='dark']");

    expect(lightThemeRule).toContain('color-scheme: light;');
    expect(darkThemeRule).toContain('color-scheme: dark;');
    expect(darkThemeRule).toContain('--background: #111111;');
  });
});

function getCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`));

  expect(rule, `Missing CSS rule: ${selector}`).not.toBeNull();

  return rule?.[1] ?? '';
}
