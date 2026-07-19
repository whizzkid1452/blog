import type { PostSummary } from '@/features/posts/model/post';
import { SITE_NAME } from '@/shared/config/site-config';
import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';

interface ResolveMobileHeaderTitleParams {
  locale: Locale;
  pathname: string | null;
  posts: PostSummary[];
}

const FIXED_PAGE_TITLES = {
  series: 'Series',
  search: 'Search',
} as const;

export function resolveMobileHeaderTitle({ locale, pathname, posts }: ResolveMobileHeaderTitleParams): string {
  if (pathname == null) {
    return SITE_NAME;
  }

  const localizedPathname = removeLocalePrefix({ locale, pathname });
  const messages = getUiMessages(locale);

  if (localizedPathname === '/') {
    return SITE_NAME;
  }

  if (localizedPathname === '/posts') {
    return messages.posts;
  }

  if (localizedPathname === '/private-posts') {
    return locale === 'ko' ? '비공개 글' : 'Private posts';
  }

  if (localizedPathname === '/series') {
    return FIXED_PAGE_TITLES.series;
  }

  if (localizedPathname === '/search') {
    return FIXED_PAGE_TITLES.search;
  }

  const postTitle = resolvePostTitle({ localizedPathname, posts });

  if (postTitle != null) {
    return postTitle;
  }

  const tagTitle = resolveTagTitle(localizedPathname);
  return tagTitle ?? SITE_NAME;
}

function removeLocalePrefix({ locale, pathname }: { locale: Locale; pathname: string }): string {
  if (locale !== 'en') {
    return pathname;
  }

  if (pathname === '/en') {
    return '/';
  }

  return pathname.startsWith('/en/') ? pathname.slice('/en'.length) : pathname;
}

function resolvePostTitle({
  localizedPathname,
  posts,
}: {
  localizedPathname: string;
  posts: PostSummary[];
}): string | null {
  const postSlug = getPathSegment({ pathname: localizedPathname, prefix: '/posts/' });

  if (postSlug == null) {
    return null;
  }

  return posts.find(post => post.slug === postSlug)?.title ?? null;
}

function resolveTagTitle(localizedPathname: string): string | null {
  const tag = getPathSegment({ pathname: localizedPathname, prefix: '/tags/' });
  return tag == null ? null : `#${tag}`;
}

function getPathSegment({ pathname, prefix }: { pathname: string; prefix: string }): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const pathSegment = pathname.slice(prefix.length);

  if (pathSegment.length === 0 || pathSegment.includes('/')) {
    return null;
  }

  return decodePathSegment(pathSegment);
}

function decodePathSegment(pathSegment: string): string {
  try {
    return decodeURIComponent(pathSegment);
  } catch {
    return pathSegment;
  }
}
