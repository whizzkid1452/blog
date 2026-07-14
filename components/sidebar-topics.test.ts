import { describe, expect, it } from 'vitest';
import { getExpandedSidebarTopicTags, getPrimarySidebarTopicTags, getSidebarTopicLabel } from './sidebar-topics';

describe('getPrimarySidebarTopicTags', () => {
  it('returns portfolio topic tags in configured order when available', () => {
    expect(getPrimarySidebarTopicTags(['webcodecs', 'drag', 'react', 'nextjs', 'performance', 'architecture'])).toEqual(
      ['react', 'architecture', 'nextjs', 'performance', 'webcodecs']
    );
  });

  it('omits portfolio topic tags without a matching published tag', () => {
    expect(getPrimarySidebarTopicTags(['react', 'drag'])).toEqual(['react']);
  });
});

describe('getExpandedSidebarTopicTags', () => {
  it('places portfolio topic tags before the remaining tags without duplicates', () => {
    expect(
      getExpandedSidebarTopicTags(['webcodecs', 'drag', 'react', 'nextjs', 'performance', 'architecture'])
    ).toEqual(['react', 'architecture', 'nextjs', 'performance', 'webcodecs', 'drag']);
  });
});

describe('getSidebarTopicLabel', () => {
  it('formats sidebar-only labels for selected topic tags', () => {
    expect(getSidebarTopicLabel('nextjs')).toBe('Next.js');
    expect(getSidebarTopicLabel('performance')).toBe('성능최적화');
    expect(getSidebarTopicLabel('state-management')).toBe('상태관리');
  });

  it('falls back to the tag value when no sidebar label exists', () => {
    expect(getSidebarTopicLabel('react')).toBe('react');
  });
});
