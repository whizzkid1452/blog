import { z } from 'zod';

export const COMMENT_AUTHOR_NAME_MAX_LENGTH = 40;
export const COMMENT_CONTENT_MAX_LENGTH = 1_000;
export const POST_SLUG_MAX_LENGTH = 160;

export const createCommentSchema = z
  .object({
    authorName: z.string().trim().min(1).max(COMMENT_AUTHOR_NAME_MAX_LENGTH),
    content: z.string().trim().min(1).max(COMMENT_CONTENT_MAX_LENGTH),
  })
  .strict();

export const postSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(POST_SLUG_MAX_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const blogCommentSchema = z
  .object({
    id: z.uuid(),
    postSlug: postSlugSchema,
    authorName: z.string().min(1).max(COMMENT_AUTHOR_NAME_MAX_LENGTH),
    content: z.string().min(1).max(COMMENT_CONTENT_MAX_LENGTH),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const commentListResponseSchema = z
  .object({
    comments: z.array(blogCommentSchema),
  })
  .strict();

export const commentCreateResponseSchema = z
  .object({
    comment: blogCommentSchema,
  })
  .strict();
