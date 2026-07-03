export const SITE_NAME = 'Blog';
export const SITE_AUTHOR_NAME = 'whizzkid1452';
export const SITE_AUTHOR_URL = 'https://github.com/whizzkid1452';
export const SITE_DESCRIPTION = '개발 과정에서 얻은 설계, 성능, 구현 경험을 기록하는 기술 블로그입니다.';
export const DEFAULT_OG_IMAGE_PATH = '/og-default.svg';
export const RSS_FEED_PATH = '/feed.xml';

const LOCAL_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): URL {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredSiteUrl != null && configuredSiteUrl.trim() !== '') {
    return new URL(configuredSiteUrl);
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl != null && vercelUrl.trim() !== '') {
    return new URL(`https://${vercelUrl}`);
  }

  return new URL(LOCAL_SITE_URL);
}

export function createAbsoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString();
}
