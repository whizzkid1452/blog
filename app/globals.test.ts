import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('theme accent colors', () => {
  it('uses accessible pink accents in light and dark color schemes', () => {
    expect(globalStyles).toContain('--color-link: #db2777;');
    expect(globalStyles.match(/--color-link: #ff69b4;/g)).toHaveLength(2);
    expect(globalStyles).not.toContain('--color-link: #f9a8d4;');
    expect(globalStyles).not.toContain('--color-link: #2563eb;');
    expect(globalStyles).not.toContain('--color-link: #93c5fd;');
  });
});

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

  it('uses translucent solid fills without decorative gradients', () => {
    const barRule = getCssRule(globalStyles, "[data-liquid-glass='bar']");
    const controlRule = getCssRule(globalStyles, "[data-liquid-glass='control']");

    expect(globalStyles).toContain('--liquid-glass-bar-fill: color-mix(in srgb, var(--background) 48%, transparent);');
    expect(globalStyles).toContain(
      '--liquid-glass-control-fill: color-mix(in srgb, var(--background) 68%, transparent);'
    );
    expect(barRule).toContain('background: var(--liquid-glass-bar-fill);');
    expect(barRule).toContain('backdrop-filter: blur(18px) saturate(175%) contrast(108%);');
    expect(controlRule).toContain('background: var(--liquid-glass-control-fill);');
    expect(barRule).not.toContain('gradient');
    expect(controlRule).not.toContain('gradient');
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
