import { z } from 'zod';

const POST_VISIBILITIES = ['public', 'authenticated'] as const;

export const postVisibilitySchema = z.enum(POST_VISIBILITIES);

export type PostVisibility = z.infer<typeof postVisibilitySchema>;

export interface PostSummary {
  slug: string;
  title: string;
  description?: string;
  date: string;
  publishedAt?: string;
  tags: string[];
  coverImage?: string;
  coverAlt?: string;
  series?: SeriesMetadata;
}

export interface SeriesMetadata {
  name: string;
  order: number;
}

export interface Post extends PostSummary {
  content: string;
  draft: boolean;
  visibility: PostVisibility;
}
