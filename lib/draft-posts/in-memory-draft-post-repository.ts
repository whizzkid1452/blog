import type { IDraftPostRepository } from './draft-post-repository';
import type { CreateDraftPostInput, DraftPost, DraftPostSummary, UpdateDraftPostInput } from './draft-post-types';

interface InMemoryDraftPostRepositoryOptions {
  initialPosts?: DraftPost[];
  createId?: () => string;
  getCurrentDateTime?: () => string;
}

const DEFAULT_DRAFT_POST_STATUS = 'draft';

export class InMemoryDraftPostRepository implements IDraftPostRepository {
  private readonly draftPostsById = new Map<string, DraftPost>();
  private readonly createId: () => string;
  private readonly getCurrentDateTime: () => string;

  constructor({
    initialPosts = [],
    createId = createRandomId,
    getCurrentDateTime = createCurrentDateTime,
  }: InMemoryDraftPostRepositoryOptions = {}) {
    this.createId = createId;
    this.getCurrentDateTime = getCurrentDateTime;

    for (const draftPost of initialPosts) {
      this.draftPostsById.set(draftPost.id, copyDraftPost(draftPost));
    }
  }

  async findSummaries(): Promise<DraftPostSummary[]> {
    return Array.from(this.draftPostsById.values()).sort(compareDraftPostsByLatestUpdate).map(toDraftPostSummary);
  }

  async findById(id: string): Promise<DraftPost | null> {
    const draftPost = this.draftPostsById.get(id);

    if (draftPost == null) {
      return null;
    }

    return copyDraftPost(draftPost);
  }

  async create(input: CreateDraftPostInput): Promise<DraftPost> {
    const currentDateTime = this.getCurrentDateTime();
    const draftPost: DraftPost = {
      id: this.createId(),
      title: input.title,
      slug: input.slug,
      content: input.content,
      tags: [...input.tags],
      status: input.status ?? DEFAULT_DRAFT_POST_STATUS,
      createdAt: currentDateTime,
      updatedAt: currentDateTime,
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.coverImage === undefined ? {} : { coverImage: input.coverImage }),
      ...(input.coverAlt === undefined ? {} : { coverAlt: input.coverAlt }),
    };

    this.draftPostsById.set(draftPost.id, copyDraftPost(draftPost));

    return copyDraftPost(draftPost);
  }

  async update(input: UpdateDraftPostInput): Promise<DraftPost | null> {
    const draftPost = this.draftPostsById.get(input.id);

    if (draftPost == null) {
      return null;
    }

    const updatedDraftPost = createUpdatedDraftPost({ draftPost, input, updatedAt: this.getCurrentDateTime() });
    this.draftPostsById.set(updatedDraftPost.id, copyDraftPost(updatedDraftPost));

    return copyDraftPost(updatedDraftPost);
  }

  async deleteById(id: string): Promise<boolean> {
    return this.draftPostsById.delete(id);
  }
}

function createUpdatedDraftPost({
  draftPost,
  input,
  updatedAt,
}: {
  draftPost: DraftPost;
  input: UpdateDraftPostInput;
  updatedAt: string;
}): DraftPost {
  const description = resolveRemovableValue({ currentValue: draftPost.description, nextValue: input.description });
  const coverImage = resolveRemovableValue({ currentValue: draftPost.coverImage, nextValue: input.coverImage });
  const coverAlt = resolveRemovableValue({ currentValue: draftPost.coverAlt, nextValue: input.coverAlt });

  return {
    id: draftPost.id,
    title: input.title ?? draftPost.title,
    slug: input.slug ?? draftPost.slug,
    content: input.content ?? draftPost.content,
    tags: input.tags === undefined ? [...draftPost.tags] : [...input.tags],
    status: input.status ?? draftPost.status,
    createdAt: draftPost.createdAt,
    updatedAt,
    ...(description === undefined ? {} : { description }),
    ...(coverImage === undefined ? {} : { coverImage }),
    ...(coverAlt === undefined ? {} : { coverAlt }),
  };
}

function resolveRemovableValue<T>({
  currentValue,
  nextValue,
}: {
  currentValue: T | undefined;
  nextValue: T | null | undefined;
}): T | undefined {
  if (nextValue === undefined) {
    return currentValue;
  }

  if (nextValue === null) {
    return undefined;
  }

  return nextValue;
}

function toDraftPostSummary(draftPost: DraftPost): DraftPostSummary {
  return {
    id: draftPost.id,
    title: draftPost.title,
    slug: draftPost.slug,
    tags: [...draftPost.tags],
    status: draftPost.status,
    createdAt: draftPost.createdAt,
    updatedAt: draftPost.updatedAt,
    ...(draftPost.description === undefined ? {} : { description: draftPost.description }),
    ...(draftPost.coverImage === undefined ? {} : { coverImage: draftPost.coverImage }),
    ...(draftPost.coverAlt === undefined ? {} : { coverAlt: draftPost.coverAlt }),
  };
}

function copyDraftPost(draftPost: DraftPost): DraftPost {
  return {
    ...draftPost,
    tags: [...draftPost.tags],
  };
}

function compareDraftPostsByLatestUpdate(leftPost: DraftPost, rightPost: DraftPost): number {
  const updatedAtComparison = new Date(rightPost.updatedAt).getTime() - new Date(leftPost.updatedAt).getTime();

  if (updatedAtComparison !== 0) {
    return updatedAtComparison;
  }

  return leftPost.id.localeCompare(rightPost.id);
}

function createRandomId(): string {
  return globalThis.crypto.randomUUID();
}

function createCurrentDateTime(): string {
  return new Date().toISOString();
}
