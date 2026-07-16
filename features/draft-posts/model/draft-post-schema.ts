import { z } from 'zod';
import type { CreateDraftPostInput, DraftPostStatus, UpdateDraftPostInput } from './draft-post-types';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_PATH_PREFIX = '/';
const PROTOCOL_RELATIVE_PATH_PREFIX = '//';

const requiredTrimmedStringSchema = z.string().trim().min(1);
const optionalTrimmedStringSchema = requiredTrimmedStringSchema.optional();
const removableTrimmedStringSchema = z.union([requiredTrimmedStringSchema, z.null()]).optional();

const tagSchema = requiredTrimmedStringSchema.refine(tag => !tag.includes('/'), {
  message: 'Tag cannot include a slash',
});

const slugSchema = requiredTrimmedStringSchema.regex(SLUG_PATTERN, {
  message: 'Slug must use lowercase letters, numbers, and single hyphens',
});

const publicPathSchema = requiredTrimmedStringSchema.refine(
  pathname => pathname.startsWith(PUBLIC_PATH_PREFIX) && !pathname.startsWith(PROTOCOL_RELATIVE_PATH_PREFIX),
  {
    message: 'Expected a public-root path starting with /',
  }
);

export const draftPostStatusSchema: z.ZodType<DraftPostStatus> = z.enum(['draft', 'ready']);

export const createDraftPostInputSchema: z.ZodType<CreateDraftPostInput> = z
  .object({
    title: requiredTrimmedStringSchema,
    slug: slugSchema,
    description: optionalTrimmedStringSchema,
    content: z.string(),
    tags: z.array(tagSchema),
    status: draftPostStatusSchema.optional(),
    coverImage: publicPathSchema.optional(),
    coverAlt: optionalTrimmedStringSchema,
  })
  .superRefine((input, context) => {
    if (input.coverImage != null && input.coverAlt == null) {
      context.addIssue({
        code: 'custom',
        path: ['coverAlt'],
        message: 'coverAlt is required when coverImage is provided',
      });
    }

    if (input.coverImage == null && input.coverAlt != null) {
      context.addIssue({
        code: 'custom',
        path: ['coverImage'],
        message: 'coverImage is required when coverAlt is provided',
      });
    }
  });

export const updateDraftPostInputSchema: z.ZodType<UpdateDraftPostInput> = z
  .object({
    id: requiredTrimmedStringSchema,
    title: optionalTrimmedStringSchema,
    slug: slugSchema.optional(),
    description: removableTrimmedStringSchema,
    content: z.string().optional(),
    tags: z.array(tagSchema).optional(),
    status: draftPostStatusSchema.optional(),
    coverImage: z.union([publicPathSchema, z.null()]).optional(),
    coverAlt: removableTrimmedStringSchema,
  })
  .refine(input => Object.keys(input).some(key => key !== 'id'), {
    message: 'Expected at least one editable field',
  });
