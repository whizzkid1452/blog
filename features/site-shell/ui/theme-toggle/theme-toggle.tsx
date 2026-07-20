'use client';

import {
  getNextTheme,
  resolveActiveTheme,
  THEME_STORAGE_KEY,
  type ColorTheme,
} from '@/features/site-shell/model/theme';
import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';
import { useEffect, useState } from 'react';
import styles from './theme-toggle.module.css';

interface ThemeToggleProps {
  locale: Locale;
}

const DARK_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function ThemeToggle({ locale }: ThemeToggleProps) {
  const [activeTheme, setActiveTheme] = useState<ColorTheme | null>(null);
  const messages = getUiMessages(locale);
  const accessibleLabel = getAccessibleLabel({ activeTheme, messages });

  useEffect(() => {
    const colorSchemeQuery = window.matchMedia(DARK_THEME_MEDIA_QUERY);
    const synchronizeTheme = () => setActiveTheme(readActiveTheme(colorSchemeQuery.matches));

    synchronizeTheme();
    colorSchemeQuery.addEventListener('change', synchronizeTheme);

    return () => colorSchemeQuery.removeEventListener('change', synchronizeTheme);
  }, []);

  const toggleTheme = () => {
    const currentTheme = readActiveTheme(window.matchMedia(DARK_THEME_MEDIA_QUERY).matches);
    const nextTheme = getNextTheme(currentTheme);

    document.documentElement.dataset.theme = nextTheme;
    storeTheme(nextTheme);
    setActiveTheme(nextTheme);
  };

  return (
    <button
      className={styles.themeToggle}
      data-motion="pressable"
      data-theme-toggle="true"
      type="button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={toggleTheme}
    >
      <svg className={styles.themeIcon} viewBox="0 0 24 24" aria-hidden="true">
        <g className={styles.lightThemeIcon} data-theme-icon="light">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
        </g>
        <path
          className={styles.darkThemeIcon}
          data-theme-icon="dark"
          d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"
        />
      </svg>
    </button>
  );
}

interface AccessibleLabelParams {
  activeTheme: ColorTheme | null;
  messages: ReturnType<typeof getUiMessages>;
}

function getAccessibleLabel({ activeTheme, messages }: AccessibleLabelParams): string {
  if (activeTheme === 'light') {
    return messages.switchToDarkThemeLabel;
  }

  if (activeTheme === 'dark') {
    return messages.switchToLightThemeLabel;
  }

  return messages.themeToggleLabel;
}

function readActiveTheme(prefersDark: boolean): ColorTheme {
  return resolveActiveTheme({ storedTheme: document.documentElement.dataset.theme ?? null, prefersDark });
}

function storeTheme(theme: ColorTheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}
