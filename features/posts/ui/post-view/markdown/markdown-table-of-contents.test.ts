import { describe, expect, it } from 'vitest';
import {
  createMarkdownHeadingIdResolver,
  hasMarkdownTableOfContents,
  prepareMarkdownContent,
} from './markdown-table-of-contents';

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
        level: 2,
        title: '디자인 시스템이란 무엇인가?',
      },
      {
        id: 'next-js-vite-다른-라이브러리-빌드-도구를-어떻게-비교했는가',
        level: 2,
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
        level: 2,
        title: '본문 제목',
      },
    ]);
  });

  it('creates a table of contents from headings after a standalone marker', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['## 부제목', '', '## 목차', '', '## 개요', '', '### 세부 조건', '', '본문'].join('\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([
      { id: '개요', level: 2, title: '개요' },
      { id: '세부-조건', level: 3, title: '세부 조건' },
    ]);
    expect(preparedContent.content).toBe('## 부제목\n\n\n## 개요\n\n### 세부 조건\n\n본문');
  });

  it('links abbreviated table-of-contents labels to headings by document order', () => {
    const preparedContent = prepareMarkdownContent({
      content: [
        '## 목차',
        '',
        '1. 수정한 스크립트 유실',
        '2. Snapshot',
        '',
        '## 문제 1. 점심을 먹고 돌아오면 수정한 스크립트가 사라졌다',
        '',
        '### Snapshot',
      ].join('\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([
      {
        id: '문제-1-점심을-먹고-돌아오면-수정한-스크립트가-사라졌다',
        level: 2,
        title: '수정한 스크립트 유실',
      },
      { id: 'snapshot', level: 3, title: 'Snapshot' },
    ]);

    const headingIdResolver = createMarkdownHeadingIdResolver({
      tableOfContentsItems: preparedContent.tableOfContentsItems,
    });

    expect(headingIdResolver.resolveId('문제 1. 점심을 먹고 돌아오면 수정한 스크립트가 사라졌다')).toBe(
      '문제-1-점심을-먹고-돌아오면-수정한-스크립트가-사라졌다'
    );
  });
});

describe('hasMarkdownTableOfContents', () => {
  it('returns true only when the markdown contains a table of contents heading', () => {
    expect(hasMarkdownTableOfContents('## 개요\n\n## 목차\n\n## 본문')).toBe(true);
    expect(hasMarkdownTableOfContents('## 개요\n\n목차를 설명하는 문장')).toBe(false);
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
