import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import { DEFAULT_OG_IMAGE_PATH, SITE_NAME, createAbsoluteUrl } from '@/shared/config/site-config';

interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface LocalizedMetadataOptions {
  locale?: Locale;
  hasAlternateLocale?: boolean;
}

const DEFAULT_OG_IMAGE_ALT = `${SITE_NAME} social preview image`;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export function createSeoImage(pathname = DEFAULT_OG_IMAGE_PATH, alt = DEFAULT_OG_IMAGE_ALT): SeoImage {
  return {
    url: createAbsoluteUrl(pathname),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt,
  };
}

export function createAlternateLanguages(pathname: string): Record<string, string> {
  return {
    'ko-KR': createAbsoluteUrl(createLocalizedPath('ko', pathname)),
    'en-US': createAbsoluteUrl(createLocalizedPath('en', pathname)),
  };
}
