import { z } from 'zod';
import type { PostThumbnail } from './post-thumbnail';

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
  visibility: PostVisibility;
  coverImage?: string;
  coverAlt?: string;
  thumbnail?: PostThumbnail;
  series?: SeriesMetadata;
  featured?: boolean;
}

export interface SeriesMetadata {
  name: string;
  order: number;
}

export interface Post extends Omit<PostSummary, 'thumbnail'> {
  content: string;
  draft: boolean;
  visibility: PostVisibility;
}
