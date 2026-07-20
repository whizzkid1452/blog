import type { DraftPost, DraftPostSummary, UpdateDraftPostInput } from '../model/draft-post-types';

interface CreateUpdatedDraftPostParams {
  draftPost: DraftPost;
  input: UpdateDraftPostInput;
  updatedAt: string;
}

export function createUpdatedDraftPost({ draftPost, input, updatedAt }: CreateUpdatedDraftPostParams): DraftPost {
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

export function toDraftPostSummary(draftPost: DraftPost): DraftPostSummary {
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

export function copyDraftPost(draftPost: DraftPost): DraftPost {
  return { ...draftPost, tags: [...draftPost.tags] };
}

export function compareDraftPostsByLatestUpdate(leftPost: DraftPost, rightPost: DraftPost): number {
  const updatedAtComparison = new Date(rightPost.updatedAt).getTime() - new Date(leftPost.updatedAt).getTime();

  return updatedAtComparison !== 0 ? updatedAtComparison : leftPost.id.localeCompare(rightPost.id);
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

  return nextValue === null ? undefined : nextValue;
}
