import type { z } from 'zod';
import type { blogCommentSchema } from './comment-schema';

export type BlogComment = z.infer<typeof blogCommentSchema>;

export interface CreateCommentInput {
  postSlug: string;
  authorName: string;
  content: string;
}

export interface CommentRepository {
  findByPostSlug(postSlug: string): Promise<BlogComment[]>;
  create(input: CreateCommentInput): Promise<BlogComment>;
}
