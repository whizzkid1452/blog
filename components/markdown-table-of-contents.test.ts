import { describe, expect, it } from 'vitest';
import { createMarkdownHeadingIdResolver, prepareMarkdownContent } from './markdown-table-of-contents';

describe('prepareMarkdownContent', () => {
  it('extracts an ordered table of contents and removes it from markdown content', () => {
    const preparedContent = prepareMarkdownContent({
      content: [
        '## 목차',
        '',
        '1. 디자인 시스템이란 무엇인가?',
        '2. Next.js, Vite, 다른 라이브러리 빌드 도구를 어떻게 비교했는가',
        '',
        '## 1. 디자인 시스템이란 무엇인가?',
        '',
        '본문',
      ].join('\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([
      {
        id: '디자인-시스템이란-무엇인가',
        title: '디자인 시스템이란 무엇인가?',
      },
      {
        id: 'next-js-vite-다른-라이브러리-빌드-도구를-어떻게-비교했는가',
        title: 'Next.js, Vite, 다른 라이브러리 빌드 도구를 어떻게 비교했는가',
      },
    ]);
    expect(preparedContent.content).toBe('## 1. 디자인 시스템이란 무엇인가?\n\n본문');
  });

  it('removes a duplicated markdown title before extracting the table of contents', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['# 글 제목', '', '## 목차', '', '1. 본문 제목', '', '## 1. 본문 제목'].join('\n'),
      title: '글 제목',
    });

    expect(preparedContent.content).toBe('## 1. 본문 제목');
    expect(preparedContent.tableOfContentsItems).toEqual([
      {
        id: '본문-제목',
        title: '본문 제목',
      },
    ]);
  });
});

describe('createMarkdownHeadingIdResolver', () => {
  it('matches numbered section headings to table of contents item ids', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['## 목차', '', '1. 디자인 시스템이란 무엇인가?', '', '## 1. 디자인 시스템이란 무엇인가?'].join('\n'),
    });
    const headingIdResolver = createMarkdownHeadingIdResolver({
      tableOfContentsItems: preparedContent.tableOfContentsItems,
    });

    expect(headingIdResolver.resolveId('1. 디자인 시스템이란 무엇인가?')).toBe('디자인-시스템이란-무엇인가');
  });

  it('adds a numeric suffix when the same heading id is used more than once', () => {
    const headingIdResolver = createMarkdownHeadingIdResolver({ tableOfContentsItems: [] });

    expect(headingIdResolver.resolveId('중복 제목')).toBe('중복-제목');
    expect(headingIdResolver.resolveId('중복 제목')).toBe('중복-제목-2');
  });
});
