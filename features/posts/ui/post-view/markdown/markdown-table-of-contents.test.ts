import { describe, expect, it } from 'vitest';
import {
  createMarkdownHeadingIdResolver,
  hasMarkdownTableOfContents,
  prepareMarkdownContent,
} from './markdown-table-of-contents';

describe('prepareMarkdownContent', () => {
  it('creates table-of-contents items only from explicitly tagged headings', () => {
    const preparedContent = prepareMarkdownContent({
      content: [
        '## [sort1] 1. 문제 상황',
        '',
        '### 목차에서 제외할 설명',
        '',
        '#### [sort2] 1-1. 원인 분석',
        '',
        '## [sort1] 2. 해결 결과',
      ].join('\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([
      { depth: 1, id: '문제-상황', title: '1. 문제 상황' },
      { depth: 2, id: '원인-분석', title: '1-1. 원인 분석' },
      { depth: 1, id: '해결-결과', title: '2. 해결 결과' },
    ]);
    expect(preparedContent.content).toBe(
      ['## 1. 문제 상황', '', '### 목차에서 제외할 설명', '', '#### 1-1. 원인 분석', '', '## 2. 해결 결과'].join('\n')
    );
  });

  it('uses the sort tag rather than the markdown heading level for table-of-contents depth', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['#### [sort1] 대목차', '## [sort3] 소목차'].join('\n\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([
      { depth: 1, id: '대목차', title: '대목차' },
      { depth: 3, id: '소목차', title: '소목차' },
    ]);
  });

  it('removes a duplicated markdown title before parsing tagged headings', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['# 글 제목', '', '## [sort1] 1. 본문 제목'].join('\n'),
      title: '글 제목',
    });

    expect(preparedContent.content).toBe('## 1. 본문 제목');
    expect(preparedContent.tableOfContentsItems).toEqual([
      {
        depth: 1,
        id: '본문-제목',
        title: '1. 본문 제목',
      },
    ]);
  });

  it('assigns unique ids to repeated tagged headings in document order', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['## [sort1] 반복 제목', '## [sort1] 반복 제목'].join('\n\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([
      { depth: 1, id: '반복-제목', title: '반복 제목' },
      { depth: 1, id: '반복-제목-2', title: '반복 제목' },
    ]);
    expect(preparedContent.headingIds).toEqual(['반복-제목', '반복-제목-2']);
  });

  it('does not treat sort tag examples inside fenced code blocks as table-of-contents items', () => {
    const preparedContent = prepareMarkdownContent({
      content: ['```md', '## [sort1] 예시 제목', '```', '', '## 일반 제목'].join('\n'),
    });

    expect(preparedContent.tableOfContentsItems).toEqual([]);
    expect(preparedContent.content).toContain('## [sort1] 예시 제목');
  });
});

describe('hasMarkdownTableOfContents', () => {
  it('returns true only when a markdown heading has a sort tag', () => {
    expect(hasMarkdownTableOfContents('## [sort1] 구현')).toBe(true);
    expect(hasMarkdownTableOfContents('## 목차\n\n## 구현')).toBe(false);
    expect(hasMarkdownTableOfContents('본문에서 [sort1]을 설명한다.')).toBe(false);
  });

  it('ignores tagged heading examples inside fenced code blocks', () => {
    expect(hasMarkdownTableOfContents(['```md', '## [sort1] 예시', '```'].join('\n'))).toBe(false);
  });
});

describe('createMarkdownHeadingIdResolver', () => {
  it('uses prepared heading ids in document order', () => {
    const headingIdResolver = createMarkdownHeadingIdResolver({ headingIds: ['first-heading', 'second-heading'] });

    expect(headingIdResolver.resolveId('첫 번째 제목')).toBe('first-heading');
    expect(headingIdResolver.resolveId('두 번째 제목')).toBe('second-heading');
  });

  it('creates unique fallback ids after prepared heading ids are exhausted', () => {
    const headingIdResolver = createMarkdownHeadingIdResolver({ headingIds: [] });

    expect(headingIdResolver.resolveId('중복 제목')).toBe('중복-제목');
    expect(headingIdResolver.resolveId('중복 제목')).toBe('중복-제목-2');
  });
});
