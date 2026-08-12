import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutStyles = readFileSync(new URL('./sidebar-topics-section.module.css', import.meta.url), 'utf8');

function getRuleDeclarations(selector: string): string {
  return layoutStyles.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)}`))?.[1] ?? '';
}

describe('sidebar topic styles', () => {
  it('keeps curated topic links aligned across the sidebar width', () => {
    expect(getRuleDeclarations('tagList')).toContain('width: 100%;');
  });
});
