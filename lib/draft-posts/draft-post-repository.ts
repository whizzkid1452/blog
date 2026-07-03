import type { CreateDraftPostInput, DraftPost, DraftPostSummary, UpdateDraftPostInput } from './draft-post-types';

export interface IDraftPostRepository {
  findSummaries(): Promise<DraftPostSummary[]>;
  findById(id: string): Promise<DraftPost | null>;
  create(input: CreateDraftPostInput): Promise<DraftPost>;
  update(input: UpdateDraftPostInput): Promise<DraftPost | null>;
  deleteById(id: string): Promise<boolean>;
}
