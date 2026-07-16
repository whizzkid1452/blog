import { describe, expect, it } from 'vitest';
import type { Post } from '../model/post';
import { applyPostTranslation, isPostTranslationFileName } from './post-translations';

describe('applyPostTranslation', () => {
  it('replaces translatable text while preserving publication metadata', () => {
    const translatedPost = applyPostTranslation({
      post: createPost(),
      translation: {
        title: 'English title',
        description: 'English description',
        content: 'English content',
      },
    });

    expect(translatedPost).toEqual({
      ...createPost(),
      title: 'English title',
      description: 'English description',
      content: 'English content',
    });
  });
});

describe('isPostTranslationFileName', () => {
  it('accepts Markdown translation files only', () => {
    expect(isPostTranslationFileName('example.md')).toBe(true);
    expect(isPostTranslationFileName('example.mdx')).toBe(false);
  });
});

function createPost(): Post {
  return {
    slug: 'example',
    title: '한국어 제목',
    description: '한국어 설명',
    date: '2026-07-14',
    tags: ['nextjs'],
    draft: false,
    visibility: 'public',
    content: '한국어 본문',
  };
}
