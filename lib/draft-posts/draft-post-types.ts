export type DraftPostStatus = 'draft' | 'ready';

export interface DraftPostEditableFields {
  title: string;
  slug: string;
  description?: string;
  content: string;
  tags: string[];
  coverImage?: string;
  coverAlt?: string;
}

export interface DraftPost extends DraftPostEditableFields {
  id: string;
  status: DraftPostStatus;
  createdAt: string;
  updatedAt: string;
}

export type DraftPostSummary = Omit<DraftPost, 'content'>;

export interface CreateDraftPostInput extends DraftPostEditableFields {
  status?: DraftPostStatus;
}

export interface UpdateDraftPostInput {
  id: string;
  title?: string;
  slug?: string;
  description?: string | null;
  content?: string;
  tags?: string[];
  status?: DraftPostStatus;
  coverImage?: string | null;
  coverAlt?: string | null;
}
