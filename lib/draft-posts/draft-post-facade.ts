import type { CreateDraftPostInput, DraftPost, DraftPostSummary, UpdateDraftPostInput } from './draft-post-types';

export interface IDraftPostFacade {
  listDraftPostSummaries(): Promise<DraftPostSummary[]>;
  getDraftPost(id: string): Promise<DraftPost | null>;
  createDraftPost(input: CreateDraftPostInput): Promise<DraftPost>;
  updateDraftPost(input: UpdateDraftPostInput): Promise<DraftPost | null>;
  deleteDraftPost(id: string): Promise<boolean>;
}
