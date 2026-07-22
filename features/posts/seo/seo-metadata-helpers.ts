import { DEFAULT_OG_IMAGE_PATH, SITE_NAME, createAbsoluteUrl } from '@/shared/config/site-config';

interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
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
