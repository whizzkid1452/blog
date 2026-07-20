import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';
import styles from './markdown-content.module.css';

describe('MarkdownContent', () => {
  it('renders explicitly tagged headings as anchor navigation', async () => {
    const markdownContent = [
      '## [sort1] 구현',
      '',
      '### 목차에서 제외할 설명',
      '',
      '## [sort2] Renderer 요청과 Main 확정',
      '',
      '### [sort3] IPC 요청 처리',
    ].join('\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('<aside');
    expect(renderedMarkup).toContain('<nav aria-labelledby="markdown-table-of-contents-title">');
    expect(renderedMarkup).toContain('<nav aria-labelledby="markdown-table-of-contents-top-title">');
    expect(renderedMarkup).toContain('href="#구현"');
    expect(renderedMarkup).toContain('href="#renderer-요청과-main-확정"');
    expect(renderedMarkup).toContain('href="#ipc-요청-처리"');
    expect(renderedMarkup).not.toContain('href="#목차에서-제외할-설명"');
    expect(renderedMarkup).toContain('data-depth="3"');
    expect(renderedMarkup).toContain('<h3 id="ipc-요청-처리">IPC 요청 처리</h3>');
    expect(renderedMarkup).not.toContain('[sort');
    expect(renderedMarkup).toContain('aria-label="목차 열기"');
    expect(renderedMarkup).toContain('data-liquid-glass="control"');
  });

  it('renders English table-of-contents controls for English posts', async () => {
    const markdownContent = '## [sort1] Implementation';

    const markdownElement = await MarkdownContent({ content: markdownContent, locale: 'en' });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('aria-label="Open table of contents"');
    expect(renderedMarkup).toContain('>Contents</span>');
  });

  it('keeps repeated table-of-contents links aligned with repeated heading ids', async () => {
    const markdownContent = ['## [sort1] 반복 제목', '## [sort1] 반복 제목'].join('\n\n');

    const markdownElement = await MarkdownContent({ content: markdownContent });
    const renderedMarkup = renderToStaticMarkup(markdownElement);

    expect(renderedMarkup).toContain('href="#반복-제목"');
    expect(renderedMarkup).toContain('href="#반복-제목-2"');
    expect(renderedMarkup).toContain('<h2 id="반복-제목">반복 제목</h2>');
    expect(renderedMarkup).toContain('<h2 id="반복-제목-2">반복 제목</h2>');
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
