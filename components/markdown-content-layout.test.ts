import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const markdownContentStyles = readFileSync(new URL('./markdown-content.module.css', import.meta.url), 'utf8');

describe('markdown content layout', () => {
  it('uses a wider desktop table of contents', () => {
    const markdownLayoutRule = markdownContentStyles.match(/\.markdownLayout\s*\{([^}]*)\}/);

    expect(markdownLayoutRule?.[1]).toContain('--table-of-contents-width: 248px;');
  });

  it('pins the desktop table of contents to the right side of the viewport', () => {
    const tableOfContentsRule = markdownContentStyles.match(/\.tableOfContentsSidebar\s*\{([^}]*)\}/);

    expect(tableOfContentsRule?.[1]).toContain('position: fixed;');
    expect(tableOfContentsRule?.[1]).toContain('right: 24px;');
  });

  it('indents third-level table of contents items', () => {
    const nestedItemRule = markdownContentStyles.match(/\.tableOfContentsListItem\[data-level='3'\]\s*\{([^}]*)\}/);

    expect(nestedItemRule?.[1]).toContain('padding-left: 16px;');
  });

  it('limits table of contents labels to two lines', () => {
    const tableOfContentsLinkRule = markdownContentStyles.match(/\.tableOfContentsLink\s*\{([^}]*)\}/);

    expect(tableOfContentsLinkRule?.[1]).toContain('-webkit-line-clamp: 2;');
  });

  it('highlights the active table of contents link', () => {
    const activeLinkRule = markdownContentStyles.match(
      /\.tableOfContentsLink\[aria-current='location'\]\s*\{([^}]*)\}/
    );

    expect(activeLinkRule?.[1]).toContain('color: var(--color-text-primary);');
    expect(activeLinkRule?.[1]).toContain('font-weight: 700;');
  });
});
