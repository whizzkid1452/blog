import { describe, expect, it, vi } from 'vitest';
import {
  findActiveHeadingId,
  findTableOfContentsScrollTop,
  scrollToTableOfContentsHeading,
} from './markdown-table-of-contents-navigation';

describe('scrollToTableOfContentsHeading', () => {
  it('smoothly scrolls to the selected heading', () => {
    const scrollIntoView = vi.fn();

    scrollToTableOfContentsHeading({ prefersReducedMotion: false, scrollIntoView });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('moves immediately when reduced motion is requested', () => {
    const scrollIntoView = vi.fn();

    scrollToTableOfContentsHeading({ prefersReducedMotion: true, scrollIntoView });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
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

describe('findTableOfContentsScrollTop', () => {
  const containerBounds = {
    containerBottom: 500,
    containerTop: 100,
    currentScrollTop: 200,
  };

  it('centers an active item above the visible table-of-contents area', () => {
    expect(
      findTableOfContentsScrollTop({
        ...containerBounds,
        currentScrollTop: 500,
        itemBottom: 90,
        itemTop: 60,
      })
    ).toBe(275);
  });

  it('centers an active item below the visible table-of-contents area', () => {
    expect(
      findTableOfContentsScrollTop({
        ...containerBounds,
        itemBottom: 550,
        itemTop: 520,
      })
    ).toBe(435);
  });

  it('centers an active item that is already visible', () => {
    expect(
      findTableOfContentsScrollTop({
        ...containerBounds,
        itemBottom: 330,
        itemTop: 300,
      })
    ).toBe(215);
  });

  it('does not return a negative scroll position', () => {
    expect(
      findTableOfContentsScrollTop({
        containerBottom: 500,
        containerTop: 100,
        currentScrollTop: 10,
        itemBottom: 20,
        itemTop: 0,
      })
    ).toBe(0);
  });
});
