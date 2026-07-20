export const THEME_STORAGE_KEY = 'blog-color-theme';

export type ColorTheme = 'light' | 'dark';

interface ResolveActiveThemeParams {
  storedTheme: string | null;
  prefersDark: boolean;
}

export function resolveActiveTheme({ storedTheme, prefersDark }: ResolveActiveThemeParams): ColorTheme {
  if (isColorTheme(storedTheme)) {
    return storedTheme;
  }

  return prefersDark ? 'dark' : 'light';
}

export function getNextTheme(currentTheme: ColorTheme): ColorTheme {
  return currentTheme === 'light' ? 'dark' : 'light';
}

export function isColorTheme(value: string | null): value is ColorTheme {
  return value === 'light' || value === 'dark';
}
