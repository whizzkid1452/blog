import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

describe('MarkdownContent', () => {
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
