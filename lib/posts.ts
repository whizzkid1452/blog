import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { validateMarkdownSeo } from './markdown-seo';
import { PostIndex } from './post-index';
import { hasPublicImage } from './public-image';
export { getPostPublishedDateTime } from './post-index';

const POSTS_DIRECTORY = path.join(process.cwd(), 'content', 'posts');
const POST_FILE_EXTENSION = '.md';
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

const postFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    date: dateSchema,
    publishedAt: dateTimeSchema.optional(),
    tags: z.array(tagSchema).min(1),
    draft: z.boolean().default(false),
    coverImage: publicPathSchema.optional(),
    coverAlt: z.string().trim().min(1).optional(),
    series: z
      .object({
        name: z.string().trim().min(1),
        order: z.number().int().positive(),
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
}

type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

interface PostSource {
  fileName: string;
  post: Post;
}

let cachedPostIndex: PostIndex | null = null;

export function getPostIndex(): PostIndex {
  if (cachedPostIndex != null) {
    return cachedPostIndex;
  }

  cachedPostIndex = new PostIndex(readAllPosts());

  return cachedPostIndex;
}

export function getPostSummaries(): PostSummary[] {
  return getPostIndex().getPostSummaries();
}

export function getPostSummariesByTag(tag: string): PostSummary[] {
  return getPostIndex().getPostSummariesByTag(tag);
}

export function getRelatedPostSummaries(post: Pick<Post, 'slug' | 'tags'>): PostSummary[] {
  return getPostIndex().getRelatedPostSummaries(post);
}

export function getTags(): string[] {
  return getPostIndex().getTags();
}

export function getPostBySlug(slug: string): Post | null {
  return getPostIndex().getPostBySlug(slug);
}

function readAllPosts(): Post[] {
  const postSources = getPostFileNames().map(readPostFile);

  validatePublishedPostMarkdown(postSources);

  return postSources.map(postSource => postSource.post);
}

function getPostFileNames(): string[] {
  if (!fs.existsSync(POSTS_DIRECTORY)) {
    return [];
  }

  return fs.readdirSync(POSTS_DIRECTORY).filter(isPostFileName).sort();
}

function readPostFile(fileName: string): PostSource {
  const fileContent = fs.readFileSync(path.join(POSTS_DIRECTORY, fileName), 'utf8');
  const { data, content } = matter(fileContent);
  const frontmatter = parseFrontmatter({ fileName, data });

  return {
    fileName,
    post: {
      slug: createSlug(fileName),
      ...frontmatter,
      content: content.trim(),
    },
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

export function isPostFileName(fileName: string): boolean {
  return path.extname(fileName) === POST_FILE_EXTENSION;
}

function createSlug(fileName: string): string {
  return fileName.slice(0, -POST_FILE_EXTENSION.length);
}

function validatePublishedPostMarkdown(postSources: PostSource[]): void {
  const publishedPosts = postSources.map(postSource => postSource.post).filter(post => !post.draft);
  const internalRoutes = createInternalRouteSet(publishedPosts);

  postSources
    .filter(postSource => !postSource.post.draft)
    .forEach(postSource =>
      validateMarkdownSeo({
        fileName: postSource.fileName,
        content: postSource.post.content,
        internalRoutes,
        hasPublicImage,
      })
    );
}

function createInternalRouteSet(posts: Post[]): Set<string> {
  const routes = new Set<string>(['/', '/posts', '/search', '/series']);

  posts.forEach(post => {
    routes.add(`/posts/${post.slug}`);

    post.tags.forEach(tag => {
      routes.add(`/tags/${encodeURIComponent(tag)}`);
    });
  });

  return routes;
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
