import type { PostSummary } from '@/features/posts/model/post';
import { SITE_NAME } from '@/shared/config/site-config';
import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';

interface ResolveSiteHeaderTitleParams {
  locale: Locale;
  pathname: string | null;
  posts: PostSummary[];
}

const FIXED_PAGE_TITLES = {
  search: 'Search',
} as const;

export function resolveSiteHeaderTitle({ locale, pathname, posts }: ResolveSiteHeaderTitleParams): string {
  if (pathname == null) {
    return SITE_NAME;
  }

  const messages = getUiMessages(locale);

  if (pathname === '/') {
    return SITE_NAME;
  }

  if (pathname === '/posts') {
    return messages.posts;
  }

  if (pathname === '/private-posts') {
    return '비공개 글';
  }

  if (pathname === '/series') {
    return messages.series;
  }

  if (pathname === '/search') {
    return FIXED_PAGE_TITLES.search;
  }

  const postTitle = resolvePostTitle({ localizedPathname: pathname, posts });

  if (postTitle != null) {
    return postTitle;
  }

  const tagTitle = resolveTagTitle(pathname);
  return tagTitle ?? SITE_NAME;
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
