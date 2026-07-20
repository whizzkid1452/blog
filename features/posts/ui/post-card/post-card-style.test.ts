import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const postCardStyles = readFileSync(new URL('./post-card.module.css', import.meta.url), 'utf8');

describe('post card style', () => {
  it('uses only horizontal separators for the card boundary', () => {
    const articleRule = getCssRule(postCardStyles, '.article');

    expect(articleRule).toContain('border: solid var(--color-border);');
    expect(articleRule).toContain('border-width: 1px 0;');
    expect(articleRule).not.toContain('border-radius');
  });

  it('keeps one separator between adjacent cards', () => {
    const adjacentArticleRule = getCssRule(postCardStyles, '.article + .article');

    expect(adjacentArticleRule).toContain('border-top-width: 0;');
  });

  it('does not add elevation when the post link is hovered', () => {
    expect(postCardStyles).not.toContain('.article:has(.postLink:hover)');
    expect(postCardStyles).not.toContain('box-shadow');
  });
});

function getCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`));

  expect(rule, `Missing CSS rule: ${selector}`).not.toBeNull();

  return rule?.[1] ?? '';
}
