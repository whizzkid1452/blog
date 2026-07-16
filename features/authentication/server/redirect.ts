const DEFAULT_RETURN_PATH = '/';
const RETURN_PATH_BASE_URL = 'https://local.invalid';

export function getSafeReturnPath(value: string | null, fallback = DEFAULT_RETURN_PATH): string {
  if (value == null || !isSafePath(value)) {
    return fallback;
  }

  const url = new URL(value, RETURN_PATH_BASE_URL);

  return `${url.pathname}${url.search}`;
}

function isSafePath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }

  return new URL(value, RETURN_PATH_BASE_URL).origin === RETURN_PATH_BASE_URL;
}
