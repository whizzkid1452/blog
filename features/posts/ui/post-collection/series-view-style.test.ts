import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const collectionStyles = readFileSync(new URL('./collection-view.module.css', import.meta.url), 'utf8');

describe('series view style', () => {
  it('removes separators from series post cards', () => {
    const seriesPostRule = getCssRule(collectionStyles, '.seriesPostList > article');

    expect(seriesPostRule).toContain('border-width: 0;');
  });
});

function getCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`));

  expect(rule, `Missing CSS rule: ${selector}`).not.toBeNull();

  return rule?.[1] ?? '';
}
