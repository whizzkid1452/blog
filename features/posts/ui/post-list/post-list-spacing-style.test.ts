import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const postListStyles = readFileSync(new URL('./post-list-view.module.css', import.meta.url), 'utf8');
const collectionStyles = readFileSync(
  new URL('../post-collection/collection-view.module.css', import.meta.url),
  'utf8'
);

describe('post list spacing', () => {
  it.each([
    ['post list', postListStyles],
    ['post collection', collectionStyles],
  ])('removes vertical space between cards in the %s', (_, styles) => {
    const postListRule = getCssRule(styles, '.postList');

    expect(postListRule).toContain('gap: 0;');
  });
});

function getCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*(?:,\\s*[^,{]+)?\\s*{([^}]*)}`));

  expect(rule, `Missing CSS rule: ${selector}`).not.toBeNull();

  return rule?.[1] ?? '';
}
