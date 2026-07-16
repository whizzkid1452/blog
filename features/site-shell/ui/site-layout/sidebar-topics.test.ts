import { describe, expect, it } from 'vitest';
import { getAdditionalSidebarTopicTags, getPrimarySidebarTopicTags, getSidebarTopicLabel } from './sidebar-topics';

describe('getPrimarySidebarTopicTags', () => {
  it('returns portfolio topic tags in configured order when available', () => {
    expect(
      getPrimarySidebarTopicTags(['electron', 'drag', 'react', 'web-worker', 'performance', 'canvas', 'architecture'])
    ).toEqual(['performance', 'architecture', 'react', 'canvas', 'web-worker', 'electron']);
  });

  it('omits portfolio topic tags without a matching published tag', () => {
    expect(getPrimarySidebarTopicTags(['react', 'drag'])).toEqual(['react']);
  });
});

describe('getAdditionalSidebarTopicTags', () => {
  it('returns only tags outside the portfolio topic set', () => {
    expect(getAdditionalSidebarTopicTags(['drag', 'react', 'nextjs', 'performance', 'architecture'])).toEqual([
      'drag',
      'nextjs',
    ]);
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
