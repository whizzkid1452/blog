export type Locale = 'ko';

export interface UiMessages {
  home: string;
  posts: string;
  series: string;
  topics: string;
  noTopics: string;
  relatedPosts: string;
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
  themeToggleLabel: string;
  switchToDarkThemeLabel: string;
  switchToLightThemeLabel: string;
}

const UI_MESSAGES: Record<Locale, UiMessages> = {
  ko: {
    home: '홈',
    posts: '전체 글',
    series: '시리즈',
    topics: '주제',
    noTopics: '등록된 주제가 없습니다.',
    relatedPosts: '관련 글',
    primaryNavigationLabel: '주요 메뉴',
    blogNavigationLabel: '블로그 메뉴',
    blogNavigationDescription: '전체 글, 시리즈, 주제를 탐색합니다.',
    menuLabel: '메뉴',
    closeLabel: '닫기',
    openBlogNavigationLabel: '블로그 메뉴 열기',
    closeBlogNavigationLabel: '블로그 메뉴 닫기',
    tableOfContentsLabel: '목차',
    tableOfContentsDescription: '현재 글의 섹션으로 이동합니다.',
    openTableOfContentsLabel: '목차 열기',
    closeTableOfContentsLabel: '목차 닫기',
    tagsLabel: '태그',
    themeToggleLabel: '색상 테마 변경',
    switchToDarkThemeLabel: '다크 모드로 전환',
    switchToLightThemeLabel: '라이트 모드로 전환',
  },
};

export function getUiMessages(locale: Locale): UiMessages {
  return UI_MESSAGES[locale];
}

export function createLocalizedPath(_locale: Locale, pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}
