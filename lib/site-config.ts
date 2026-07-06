export const SITE_NAME = 'Blog';
export const SITE_AUTHOR_NAME = 'whizzkid1452';
export const SITE_AUTHOR_URL = 'https://github.com/whizzkid1452';
export const SITE_DESCRIPTION = '개발 과정에서 얻은 설계, 성능, 구현 경험을 기록하는 기술 블로그입니다.';
export const DEFAULT_OG_IMAGE_PATH = '/og-default.svg';
export const RSS_FEED_PATH = '/feed.xml';

const LOCAL_SITE_URL = 'http://localhost:3000';
const PRODUCTION_NODE_ENV = 'production';
const WEB_URL_PROTOCOLS = new Set(['http:', 'https:']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

export function getSiteUrl(): URL {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredSiteUrl != null && configuredSiteUrl.trim() !== '') {
    return parsePublicSiteUrl({ sourceName: 'NEXT_PUBLIC_SITE_URL', value: configuredSiteUrl });
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl != null && vercelUrl.trim() !== '') {
    return parsePublicSiteUrl({ sourceName: 'VERCEL_URL', value: `https://${vercelUrl}` });
  }

  if (isProductionRuntime()) {
    throw new Error('NEXT_PUBLIC_SITE_URL or VERCEL_URL is required to create production SEO URLs');
  }

  return new URL(LOCAL_SITE_URL);
}

export function createAbsoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString();
}

function parsePublicSiteUrl({ sourceName, value }: { sourceName: string; value: string }): URL {
  const url = new URL(value.trim());

  if (!WEB_URL_PROTOCOLS.has(url.protocol)) {
    throw new Error(`${sourceName} must use an HTTP or HTTPS URL`);
  }

  if (isProductionRuntime() && LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new Error(`${sourceName} must not point to a local host in production`);
  }

  return url;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === PRODUCTION_NODE_ENV;
}
