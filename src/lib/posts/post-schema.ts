import { z } from 'zod';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z.preprocess(
  value => {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return value;
  },
  z
    .string()
    .regex(DATE_ONLY_PATTERN, 'Expected a YYYY-MM-DD date')
    .refine(isValidDateOnly, 'Expected a valid calendar date')
);

export const postFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  publishedAt: dateOnlySchema,
  updatedAt: dateOnlySchema.optional(),
  tags: z.array(z.string().trim().min(1)).min(1),
  draft: z.boolean().default(false),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

export function parsePostFrontmatter({ fileName, frontmatter }: { fileName: string; frontmatter: unknown }) {
  const result = postFrontmatterSchema.safeParse(frontmatter);

  if (result.success) {
    return result.data;
  }

  const issueMessage = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid frontmatter in ${fileName}: ${issueMessage}`);
}

function isValidDateOnly(value: string) {
  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return parsedDate.toISOString().slice(0, 10) === value;
}
