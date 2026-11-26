import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = [
  readFileSync(new URL('./globals.css', import.meta.url), 'utf8'),
  readFileSync(new URL('./styles/theme.css', import.meta.url), 'utf8'),
  readFileSync(new URL('./styles/liquid-glass.css', import.meta.url), 'utf8'),
].join('\n');

describe('root scroll behavior', () => {
  it('disables horizontal overscroll on the document', () => {
    const htmlRule = getCssRule(globalStyles, 'html');
    const bodyRule = getCssRule(globalStyles, 'body');

    expect(htmlRule).toContain('overscroll-behavior-x: none;');
    expect(bodyRule).toContain('overscroll-behavior-x: none;');
  });
});

describe('theme accent colors', () => {
  it('keeps links readable on page, reading, and console surfaces in both themes', () => {
    for (const selector of [':root', ":root[data-theme='dark']"]) {
      const rule = getCssRule(globalStyles, selector);
      const foreground = readColorToken({ rule, name: '--color-link' });

      for (const name of ['--background', '--console-reading', '--console-screen']) {
        const background = readColorToken({ rule, name });
        const luminances = [foreground, background].map(color => relativeLuminance({ color }));
        const contrast = (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);

        expect(contrast, `${selector} link contrast on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
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

function readColorToken({ rule, name }: { rule: string; name: string }): string {
  const color = rule.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1];

  if (color === undefined) {
    throw new Error(`Missing color token ${name}`);
  }

  return color;
}

function relativeLuminance({ color }: { color: string }): number {
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
