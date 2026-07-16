export const SUPPORTED_LOCALES = ['ko', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ko';

export interface UiMessages {
  home: string;
  posts: string;
  topics: string;
  viewAllTopics: string;
  collapseTopics: string;
  recent: string;
  noTopics: string;
  noPosts: string;
  relatedPosts: string;
  languageLinkLabel: string;
  primaryNavigationLabel: string;
  blogNavigationLabel: string;
  tagsLabel: string;
}

const UI_MESSAGES: Record<Locale, UiMessages> = {
  ko: {
    home: '홈',
    posts: '글',
    topics: '주제',
    viewAllTopics: '전체보기',
    collapseTopics: '접기',
    recent: '최근 글',
    noTopics: '등록된 주제가 없습니다.',
    noPosts: '등록된 글이 없습니다.',
    relatedPosts: '관련 글',
    languageLinkLabel: 'English',
    primaryNavigationLabel: '주요 메뉴',
    blogNavigationLabel: '블로그 메뉴',
    tagsLabel: '태그',
  },
  en: {
    home: 'Home',
    posts: 'Posts',
    topics: 'Topics',
    viewAllTopics: 'View all',
    collapseTopics: 'Show less',
    recent: 'Recent',
    noTopics: 'No topics yet.',
    noPosts: 'No posts yet.',
    relatedPosts: 'Related posts',
    languageLinkLabel: '한국어',
    primaryNavigationLabel: 'Primary navigation',
    blogNavigationLabel: 'Blog navigation',
    tagsLabel: 'Tags',
  },
};

export function getUiMessages(locale: Locale): UiMessages {
  return UI_MESSAGES[locale];
}

export function createLocalizedPath(locale: Locale, pathname: string): string {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (locale === DEFAULT_LOCALE) {
    return normalizedPathname;
  }

  return normalizedPathname === '/' ? '/en' : `/en${normalizedPathname}`;
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'ko' ? 'en' : 'ko';
}

export function getHtmlLanguage(locale: Locale): string {
  return locale === 'ko' ? 'ko' : 'en';
}

export function getContentLanguage(locale: Locale): string {
  return locale === 'ko' ? 'ko-KR' : 'en-US';
}

export function getOpenGraphLocale(locale: Locale): string {
  return locale === 'ko' ? 'ko_KR' : 'en_US';
}
