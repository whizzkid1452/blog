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
  blogNavigationDescription: string;
  menuLabel: string;
  closeLabel: string;
  openBlogNavigationLabel: string;
  closeBlogNavigationLabel: string;
  tableOfContentsLabel: string;
  tableOfContentsDescription: string;
  openTableOfContentsLabel: string;
  closeTableOfContentsLabel: string;
  tagsLabel: string;
}

const UI_MESSAGES: Record<Locale, UiMessages> = {
  ko: {
    home: '홈',
    posts: 'Posts',
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
    blogNavigationDescription: '주요 메뉴, 주제, 최근 글을 탐색합니다.',
    menuLabel: '메뉴',
    closeLabel: '닫기',
    openBlogNavigationLabel: '블로그 메뉴 열기',
    closeBlogNavigationLabel: '블로그 메뉴 닫기',
    tableOfContentsLabel: '목차',
    tableOfContentsDescription: '현재 글의 섹션으로 이동합니다.',
    openTableOfContentsLabel: '목차 열기',
    closeTableOfContentsLabel: '목차 닫기',
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
    blogNavigationDescription: 'Browse primary links, topics, and recent posts.',
    menuLabel: 'Menu',
    closeLabel: 'Close',
    openBlogNavigationLabel: 'Open blog navigation',
    closeBlogNavigationLabel: 'Close blog navigation',
    tableOfContentsLabel: 'Contents',
    tableOfContentsDescription: 'Navigate to a section in the current post.',
    openTableOfContentsLabel: 'Open table of contents',
    closeTableOfContentsLabel: 'Close table of contents',
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
