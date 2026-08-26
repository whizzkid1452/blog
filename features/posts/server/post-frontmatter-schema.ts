import { z } from 'zod';
import { postVisibilitySchema } from '../model/post';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_WITH_TIME_ZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .refine(tag => !tag.includes('/'), 'Tag cannot include a slash');

const dateSchema = z.preprocess(
  value => {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return value;
  },
  z.string().regex(DATE_ONLY_PATTERN, 'Expected a YYYY-MM-DD date').refine(isValidDate, 'Expected a valid date')
);

const dateTimeSchema = z.preprocess(
  value => {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  },
  z
    .string()
    .regex(DATE_TIME_WITH_TIME_ZONE_PATTERN, 'Expected an ISO 8601 date-time with timezone')
    .refine(isValidDateTime, 'Expected a valid date-time')
);

const publicPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(pathname => pathname.startsWith('/') && !pathname.startsWith('//'), {
    message: 'Expected a public-root path starting with /',
  });

export const postFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    date: dateSchema,
    publishedAt: dateTimeSchema.optional(),
    tags: z.array(tagSchema).min(1),
    draft: z.boolean().default(false),
    visibility: postVisibilitySchema.default('public'),
    featured: z.boolean().default(false),
    coverImage: publicPathSchema.optional(),
    coverAlt: z.string().trim().min(1).optional(),
    series: z
      .object({
        name: z.string().trim().min(1),
        order: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .superRefine((frontmatter, context) => {
    if (!frontmatter.draft && frontmatter.description == null) {
      context.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Published posts require a description',
      });
    }

    if (frontmatter.coverImage != null && frontmatter.coverAlt == null) {
      context.addIssue({
        code: 'custom',
        path: ['coverAlt'],
        message: 'coverAlt is required when coverImage is provided',
      });
    }

    if (frontmatter.coverImage == null && frontmatter.coverAlt != null) {
      context.addIssue({
        code: 'custom',
        path: ['coverImage'],
        message: 'coverImage is required when coverAlt is provided',
      });
    }
  });

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

function isValidDateTime(value: string): boolean {
  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}
