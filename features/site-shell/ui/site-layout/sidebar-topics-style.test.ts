import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutStyles = readFileSync(new URL('./sidebar-topics-section.module.css', import.meta.url), 'utf8');

function getRuleDeclarations(selector: string): string {
  return layoutStyles.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)}`))?.[1] ?? '';
}

describe('sidebar topic styles', () => {
  it('keeps expanded topic chevrons aligned with primary topic chevrons', () => {
    expect(getRuleDeclarations('sidebarAdditionalTopics')).toContain('width: 100%;');
    expect(getRuleDeclarations('sidebarCollapsibleContent')).toContain('width: 100%;');
  });
});
