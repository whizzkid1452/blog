import { describe, expect, it } from 'vitest';
import { InMemoryDraftPostRepository } from './in-memory-draft-post-repository';
import type { DraftPost } from './draft-post-types';

const FIRST_TIMESTAMP = '2026-07-03T00:00:00.000Z';
const SECOND_TIMESTAMP = '2026-07-03T00:01:00.000Z';

function createDraftPost(overrides: Partial<DraftPost> = {}): DraftPost {
  const { tags, ...draftPostOverrides } = overrides;
  const defaultDraftPost: DraftPost = {
    id: 'draft-1',
    title: 'Draft title',
    slug: 'draft-title',
    content: '# Draft',
    tags: ['react'],
    status: 'draft',
    createdAt: FIRST_TIMESTAMP,
    updatedAt: FIRST_TIMESTAMP,
  };

  return {
    ...defaultDraftPost,
    ...draftPostOverrides,
    tags: tags ?? [...defaultDraftPost.tags],
  };
}

describe('InMemoryDraftPostRepository', () => {
  it('creates a draft post with generated metadata', async () => {
    const repository = new InMemoryDraftPostRepository({
      createId: () => 'draft-1',
      getCurrentDateTime: () => FIRST_TIMESTAMP,
    });

    const draftPost = await repository.create({
      title: 'Draft title',
      slug: 'draft-title',
      content: '# Draft',
      tags: ['react'],
    });

    expect(draftPost).toEqual({
      id: 'draft-1',
      title: 'Draft title',
      slug: 'draft-title',
      content: '# Draft',
      tags: ['react'],
      status: 'draft',
      createdAt: FIRST_TIMESTAMP,
      updatedAt: FIRST_TIMESTAMP,
    });
  });

  it('returns summaries without content ordered by latest update time', async () => {
    const repository = new InMemoryDraftPostRepository({
      initialPosts: [
        createDraftPost({ id: 'draft-1', updatedAt: FIRST_TIMESTAMP }),
        createDraftPost({ id: 'draft-2', title: 'Second draft', slug: 'second-draft', updatedAt: SECOND_TIMESTAMP }),
      ],
    });

    const summaries = await repository.findSummaries();

    expect(summaries).toEqual([
      {
        id: 'draft-2',
        title: 'Second draft',
        slug: 'second-draft',
        tags: ['react'],
        status: 'draft',
        createdAt: FIRST_TIMESTAMP,
        updatedAt: SECOND_TIMESTAMP,
      },
      {
        id: 'draft-1',
        title: 'Draft title',
        slug: 'draft-title',
        tags: ['react'],
        status: 'draft',
        createdAt: FIRST_TIMESTAMP,
        updatedAt: FIRST_TIMESTAMP,
      },
    ]);
  });

  it('does not expose mutable internal post references', async () => {
    const repository = new InMemoryDraftPostRepository({
      initialPosts: [createDraftPost()],
    });

    const draftPost = await repository.findById('draft-1');

    if (draftPost == null) {
      throw new Error('Expected draft post to exist');
    }

    draftPost.tags.push('mutated');

    const storedDraftPost = await repository.findById('draft-1');

    expect(storedDraftPost?.tags).toEqual(['react']);
  });

  it('updates editable fields and removes nullable optional fields', async () => {
    const repository = new InMemoryDraftPostRepository({
      initialPosts: [
        createDraftPost({
          description: 'Description',
          coverImage: '/cover.png',
          coverAlt: 'Cover image',
        }),
      ],
      getCurrentDateTime: () => SECOND_TIMESTAMP,
    });

    const draftPost = await repository.update({
      id: 'draft-1',
      title: 'Updated draft',
      description: null,
      coverImage: null,
      coverAlt: null,
      tags: ['typescript'],
    });

    expect(draftPost).toEqual({
      id: 'draft-1',
      title: 'Updated draft',
      slug: 'draft-title',
      content: '# Draft',
      tags: ['typescript'],
      status: 'draft',
      createdAt: FIRST_TIMESTAMP,
      updatedAt: SECOND_TIMESTAMP,
    });
  });

  it('returns null when updating a missing draft post', async () => {
    const repository = new InMemoryDraftPostRepository();

    await expect(repository.update({ id: 'missing-draft', title: 'Updated draft' })).resolves.toBeNull();
  });

  it('deletes a draft post by id', async () => {
    const repository = new InMemoryDraftPostRepository({
      initialPosts: [createDraftPost()],
    });

    await expect(repository.deleteById('draft-1')).resolves.toBe(true);
    await expect(repository.findById('draft-1')).resolves.toBeNull();
    await expect(repository.deleteById('draft-1')).resolves.toBe(false);
  });
});
