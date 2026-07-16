import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';
import styles from './markdown-content.module.css';

describe('MarkdownContent', () => {
  it('renders a standalone table of contents marker as anchor navigation', async () => {
    const markdownContent = [
      '## 목차',
      '',
      '## 구현',
      '',
      '### Renderer 요청과 Main 확정',
      '',
      '#### IPC 요청 처리',
    ].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('<aside');
    expect(renderedMarkup).toContain('<nav aria-labelledby="markdown-table-of-contents-title">');
    expect(renderedMarkup).toContain('<nav aria-labelledby="markdown-table-of-contents-top-title">');
    expect(renderedMarkup).toContain('href="#구현"');
    expect(renderedMarkup).toContain('href="#renderer-요청과-main-확정"');
    expect(renderedMarkup).toContain('href="#ipc-요청-처리"');
    expect(renderedMarkup).toContain('data-level="4"');
    expect(renderedMarkup).toContain('<h4 id="ipc-요청-처리">IPC 요청 처리</h4>');
    expect(renderedMarkup).toContain('aria-label="목차 열기"');
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

  it('renders a table inside a centered horizontal scroll container', async () => {
    const markdownContent = ['| 기능 | 상태 |', '| --- | --- |', '| 이미지 확대 | 완료 |'].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain(`<div class="${styles.markdownTableContainer}"><table>`);
  });

  it('renders an image as a button that opens the full-screen view', async () => {
    const markdownContent = '![확대할 예시 이미지](https://example.com/example.png)';

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('type="button"');
    expect(renderedMarkup).toContain('aria-label="확대할 예시 이미지 전체 화면으로 보기"');
    expect(renderedMarkup).toContain('src="https://example.com/example.png"');
  });
});
