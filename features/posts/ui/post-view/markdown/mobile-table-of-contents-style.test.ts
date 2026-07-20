import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const markdownStyles = readFileSync(new URL('./markdown-content.module.css', import.meta.url), 'utf8');
const mobileTableOfContentsContentStyles =
  markdownStyles.match(/\.mobileTableOfContentsContent\s*{([^}]*)}/)?.[1] ?? '';

describe('mobile table of contents styles', () => {
  it('renders the trigger without a border', () => {
    const triggerRules = Array.from(markdownStyles.matchAll(/([^{}]+)\{([^{}]*)}/g))
      .filter(([, selector]) => selector.includes('.mobileTableOfContentsTrigger'))
      .map(([, , declarations]) => declarations);

    expect(triggerRules.length).toBeGreaterThan(0);
    expect(triggerRules.every(rule => !hasVisibleBorderDeclaration(rule))).toBe(true);
  });

  it('renders the drawer without a left divider', () => {
    expect(mobileTableOfContentsContentStyles).not.toContain('border-left:');
  });
});

function hasVisibleBorderDeclaration(declarations: string): boolean {
  const borderDeclarations = declarations.matchAll(
    /(?:^|;)\s*border(?:-(?:top|right|bottom|left))?(?:-(?:color|style|width))?\s*:\s*([^;]+)/g
  );

  return Array.from(borderDeclarations, ([, value]) => value.trim()).some(value => value !== '0' && value !== 'none');
}
