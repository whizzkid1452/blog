import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const markdownStyles = readFileSync(new URL('./markdown-content.module.css', import.meta.url), 'utf8');

describe('markdown heading spacing', () => {
  it('keeps one body-text line between every heading and the following content', () => {
    expect(markdownStyles).toContain('--markdown-heading-content-spacing: 32px;');

    expect(markdownStyles).toMatch(/\.content h1\s*{[\s\S]*?margin:\s*0 0 var\(--markdown-heading-content-spacing\);/);

    for (const headingLevel of [2, 3, 4]) {
      expect(markdownStyles).toMatch(
        new RegExp(
          `\\.content h${headingLevel}\\s*{[\\s\\S]*?margin:\\s*[^;]+ 0 var\\(--markdown-heading-content-spacing\\);`
        )
      );
    }
  });
});
