import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';

const POSTS_DIRECTORY = path.join(process.cwd(), 'content', 'posts');
const POST_FILE_EXTENSIONS = ['.md', '.mdx'];
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

const postFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  date: dateSchema,
  publishedAt: dateTimeSchema.optional(),
  tags: z.array(tagSchema).min(1),
  draft: z.boolean().default(false),
});

export interface PostSummary {
  slug: string;
  title: string;
  description?: string;
  date: string;
  publishedAt?: string;
  tags: string[];
}

export interface Post extends PostSummary {
  content: string;
  draft: boolean;
}

type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

export function getPostSummaries(): PostSummary[] {
  return getPublishedPosts().map(toPostSummary);
}

export function getPostSummariesByTag(tag: string): PostSummary[] {
  return getPostSummaries().filter(post => post.tags.includes(tag));
}

export function getTags(): string[] {
  return Array.from(new Set(getPostSummaries().flatMap(post => post.tags))).sort((leftTag, rightTag) =>
    leftTag.localeCompare(rightTag)
  );
}

export function getPostBySlug(slug: string): Post | null {
  const fileName = getPostFileNameBySlug(slug);

  if (fileName == null) {
    return null;
  }

  const post = readPostFile(fileName);

  if (post.draft) {
    return null;
  }

  return post;
}

export function getPostPublishedDateTime(post: Pick<Post, 'date' | 'publishedAt'>): string {
  return post.publishedAt ?? `${post.date}T00:00:00.000Z`;
}

function getPublishedPosts(): Post[] {
  return getPostFileNames()
    .map(readPostFile)
    .filter(post => !post.draft)
    .sort(comparePosts);
}

function toPostSummary(post: Post): PostSummary {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    date: post.date,
    publishedAt: post.publishedAt,
    tags: post.tags,
  };
}

function getPostFileNameBySlug(slug: string): string | null {
  return getPostFileNames().find(fileName => createSlug(fileName) === slug) ?? null;
}

function getPostFileNames(): string[] {
  if (!fs.existsSync(POSTS_DIRECTORY)) {
    return [];
  }

  return fs.readdirSync(POSTS_DIRECTORY).filter(isPostFileName).sort();
}

function readPostFile(fileName: string): Post {
  const fileContent = fs.readFileSync(path.join(POSTS_DIRECTORY, fileName), 'utf8');
  const { data, content } = matter(fileContent);
  const frontmatter = parseFrontmatter({ fileName, data });

  return {
    slug: createSlug(fileName),
    ...frontmatter,
    content: content.trim(),
  };
}

function parseFrontmatter({ fileName, data }: { fileName: string; data: unknown }): PostFrontmatter {
  const result = postFrontmatterSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const message = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid frontmatter in ${fileName}: ${message}`);
}

function isPostFileName(fileName: string): boolean {
  return POST_FILE_EXTENSIONS.includes(path.extname(fileName));
}

function createSlug(fileName: string): string {
  return fileName.replace(/\.(md|mdx)$/, '');
}

function comparePosts(leftPost: Post, rightPost: Post): number {
  const publishTimeComparison = getPostPublishTime(rightPost) - getPostPublishTime(leftPost);

  if (publishTimeComparison !== 0) {
    return publishTimeComparison;
  }

  return leftPost.slug.localeCompare(rightPost.slug);
}

function getPostPublishTime(post: Pick<Post, 'date' | 'publishedAt'>): number {
  return new Date(getPostPublishedDateTime(post)).getTime();
}

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
