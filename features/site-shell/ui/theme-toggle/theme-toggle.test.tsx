import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  it('renders an accessible theme button with both theme icons', () => {
    const markup = renderToStaticMarkup(<ThemeToggle locale="ko" />);

    expect(markup).toContain('aria-label="색상 테마 변경"');
    expect(markup).toContain('data-theme-toggle="true"');
    expect(markup).toContain('data-theme-icon="light"');
    expect(markup).toContain('data-theme-icon="dark"');
  });
});
