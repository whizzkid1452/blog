import { describe, expect, it } from 'vitest';
import { createDraftPostInputSchema, updateDraftPostInputSchema } from './draft-post-schema';

describe('createDraftPostInputSchema', () => {
  it('accepts valid draft post input', () => {
    const result = createDraftPostInputSchema.safeParse({
      title: ' Draft title ',
      slug: 'draft-title',
      content: '# Draft\n\nBody',
      tags: [' react ', 'architecture'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: 'Draft title',
      slug: 'draft-title',
      content: '# Draft\n\nBody',
      tags: ['react', 'architecture'],
    });
  });

  it('rejects a slug that cannot be used as one URL path segment', () => {
    const result = createDraftPostInputSchema.safeParse({
      title: 'Draft title',
      slug: 'draft/title',
      content: '',
      tags: [],
    });

    expect(result.success).toBe(false);
  });

  it('requires cover alt text when cover image is provided', () => {
    const result = createDraftPostInputSchema.safeParse({
      title: 'Draft title',
      slug: 'draft-title',
      content: '',
      tags: [],
      coverImage: '/cover.png',
    });

    expect(result.success).toBe(false);
  });
});

describe('updateDraftPostInputSchema', () => {
  it('accepts null for removing optional fields', () => {
    const result = updateDraftPostInputSchema.safeParse({
      id: 'draft-1',
      description: null,
      coverImage: null,
      coverAlt: null,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: 'draft-1',
      description: null,
      coverImage: null,
      coverAlt: null,
    });
  });

  it('rejects update input without editable fields', () => {
    const result = updateDraftPostInputSchema.safeParse({
      id: 'draft-1',
    });

    expect(result.success).toBe(false);
  });
});
