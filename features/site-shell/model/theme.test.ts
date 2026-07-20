import { describe, expect, it } from 'vitest';
import { getNextTheme, resolveActiveTheme } from './theme';

describe('theme preference', () => {
  it('uses the stored theme instead of the system preference', () => {
    expect(resolveActiveTheme({ storedTheme: 'light', prefersDark: true })).toBe('light');
  });

  it('uses the system preference when no theme is stored', () => {
    expect(resolveActiveTheme({ storedTheme: null, prefersDark: true })).toBe('dark');
  });

  it('ignores unsupported stored values', () => {
    expect(resolveActiveTheme({ storedTheme: 'sepia', prefersDark: false })).toBe('light');
  });

  it('alternates between light and dark themes', () => {
    expect(getNextTheme('light')).toBe('dark');
    expect(getNextTheme('dark')).toBe('light');
  });
});
