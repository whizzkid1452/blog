import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const commentsSectionStyles = readFileSync(new URL('./comment-form.module.css', import.meta.url), 'utf8');

describe('comments section style', () => {
  it('uses the accent color for the submit button in light mode', () => {
    const submitButtonRule = getCssRule(commentsSectionStyles, ":global(html[data-theme='light']) .submitButton");

    expect(submitButtonRule).toContain('background: var(--color-link);');
    expect(submitButtonRule).toContain('color: var(--background);');
  });

  it('uses a dark surface for the submit button in dark mode', () => {
    const darkModeStyles = getDarkModeStyles(commentsSectionStyles);
    const submitButtonRule = getCssRule(darkModeStyles, '.submitButton');

    expect(submitButtonRule).toContain('background: var(--color-border);');
    expect(submitButtonRule).toContain('color: var(--color-text-primary);');
  });
});

function getDarkModeStyles(styles: string): string {
  const mediaQueryStart = styles.indexOf('@media (prefers-color-scheme: dark)');

  expect(mediaQueryStart, 'Missing dark mode media query').toBeGreaterThanOrEqual(0);

  return styles.slice(mediaQueryStart);
}

function getCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`));

  expect(rule, `Missing CSS rule: ${selector}`).not.toBeNull();

  return rule?.[1] ?? '';
}
