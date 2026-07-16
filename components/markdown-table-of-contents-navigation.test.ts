import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findActiveHeadingId, MarkdownTableOfContentsNavigation } from './markdown-table-of-contents-navigation';

describe('MarkdownTableOfContentsNavigation', () => {
  it('renders only the external sidebar and narrow-screen trigger', () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownTableOfContentsNavigation, {
        items: [{ id: 'overview', level: 2, title: 'Overview' }],
      })
    );

    expect(markup).toContain('<aside');
    expect(markup).toContain('aria-label="목차 열기"');
    expect(markup).not.toContain('markdown-table-of-contents-top-title');
  });
});

describe('findActiveHeadingId', () => {
  const headingPositions = [
    { id: 'first', top: -240 },
    { id: 'second', top: 80 },
    { id: 'third', top: 480 },
  ];

  it('returns the last heading that reached the activation offset', () => {
    expect(findActiveHeadingId({ activationOffset: 96, headingPositions })).toBe('second');
  });

  it('returns the first heading before the reader reaches the article headings', () => {
    expect(
      findActiveHeadingId({
        activationOffset: 96,
        headingPositions: headingPositions.map(heading => ({ ...heading, top: heading.top + 500 })),
      })
    ).toBe('first');
  });

  it('returns null when no table-of-contents heading is available', () => {
    expect(findActiveHeadingId({ activationOffset: 96, headingPositions: [] })).toBeNull();
  });

  it('returns the final heading at the end of the document', () => {
    expect(findActiveHeadingId({ activationOffset: 96, headingPositions, isDocumentEnd: true })).toBe('third');
  });
});
