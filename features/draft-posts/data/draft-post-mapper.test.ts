import { describe, expect, it } from 'vitest';
import { createUpdatedDraftPost, toDraftPostSummary } from './draft-post-mapper';
import type { DraftPost } from '../model/draft-post-types';

const draftPost: DraftPost = {
  id: 'draft-1',
  title: 'Draft title',
  slug: 'draft-title',
  description: 'Description',
  content: '# Draft',
  tags: ['react'],
  status: 'draft',
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
};

describe('createUpdatedDraftPost', () => {
  it('removes nullable optional fields without mutating unchanged fields', () => {
    expect(
      createUpdatedDraftPost({
        draftPost,
        input: { id: draftPost.id, description: null },
        updatedAt: '2026-07-03T00:01:00.000Z',
      })
    ).toEqual({
      ...draftPost,
      description: undefined,
      updatedAt: '2026-07-03T00:01:00.000Z',
    });
  });
});

describe('toDraftPostSummary', () => {
  it('omits content and copies the tags collection', () => {
    const summary = toDraftPostSummary(draftPost);

    expect(summary).not.toHaveProperty('content');
    expect(summary.tags).toEqual(['react']);
    expect(summary.tags).not.toBe(draftPost.tags);
  });
});
