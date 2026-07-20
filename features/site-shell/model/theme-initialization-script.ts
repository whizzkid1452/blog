import { THEME_STORAGE_KEY } from './theme';

export const THEME_INITIALIZATION_SCRIPT = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}');

    if (storedTheme === 'light' || storedTheme === 'dark') {
      document.documentElement.dataset.theme = storedTheme;
    }
  } catch {}
})();
`;
