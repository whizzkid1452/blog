import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

describe('MarkdownContent', () => {
  it('renders a standalone table of contents marker as anchor navigation', async () => {
    const markdownContent = ['## 목차', '', '## 개요', '', '### 세부 조건'].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('<aside');
    expect(renderedMarkup).toContain('<nav aria-labelledby="markdown-table-of-contents-title">');
    expect(renderedMarkup).toContain('href="#개요"');
    expect(renderedMarkup).toContain('href="#세부-조건"');
  });

  it('removes structural section numbers from table of contents labels', async () => {
    const markdownContent = ['## 목차', '', '## 문제 1. 오래된 값이 저장된다'].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('href="#문제-1-오래된-값이-저장된다">오래된 값이 저장된다</a>');
  });

  it('links concise table of contents labels to the original heading', async () => {
    const markdownContent = ['## 목차', '', '1. 저장 문제', '', '## 문제 1. 오래된 값이 저장되고 있었다'].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('href="#문제-1-오래된-값이-저장되고-있었다">저장 문제</a>');
    expect(renderedMarkup).toContain(
      '<h2 id="문제-1-오래된-값이-저장되고-있었다">문제 1. 오래된 값이 저장되고 있었다</h2>'
    );
  });

  it('renders markdown details markup as a collapsed disclosure element', async () => {
    const markdownContent = [
      '<details>',
      '<summary>이 글의 목차 펼쳐보기</summary>',
      '',
      '- [첫 번째 섹션](#first-section)',
      '',
      '</details>',
      '',
      '## 첫 번째 섹션',
    ].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toMatch(/<details(?:\s|>)/);
    expect(renderedMarkup).toMatch(/<summary[^>]*>이 글의 목차 펼쳐보기<\/summary>/);
    expect(renderedMarkup).not.toContain('<details open');
    expect(renderedMarkup).not.toContain('&lt;details&gt;');
  });
});
