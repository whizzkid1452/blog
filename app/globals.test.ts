import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('liquid glass surface styles', () => {
  it('provides a solid fallback when backdrop filtering is unavailable', () => {
    expect(globalStyles).toContain('@supports not ((backdrop-filter: blur(1px))');
    expect(globalStyles).toContain("[data-liquid-glass='bar']");
    expect(globalStyles).toContain("[data-liquid-glass='control']");
  });

  it('removes transparency when the user requests it', () => {
    expect(globalStyles).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(globalStyles).toContain('@media (forced-colors: active)');
  });

  it('uses the page background for navigation surfaces without a decorative control gradient', () => {
    const barRule = getCssRule(globalStyles, "[data-liquid-glass='bar']");
    const controlRule = getCssRule(globalStyles, "[data-liquid-glass='control']");

    expect(barRule).toContain('background: var(--background);');
    expect(controlRule).toContain('background: var(--background);');
    expect(barRule).not.toContain('gradient');
    expect(globalStyles).not.toContain("[data-liquid-glass='control']::before");
  });

  it('does not draw inset edge lines around glass surfaces', () => {
    const barRule = getCssRule(globalStyles, "[data-liquid-glass='bar']");
    const controlRule = getCssRule(globalStyles, "[data-liquid-glass='control']");

    for (const glassSurfaceRule of [barRule, controlRule]) {
      expect(glassSurfaceRule).not.toContain('border');
      expect(glassSurfaceRule).not.toContain('inset');
    }
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
