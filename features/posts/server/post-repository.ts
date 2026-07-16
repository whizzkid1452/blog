import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { PostIndex } from '../model/post-index';
import type { Post, PostSummary } from '../model/post';
import { validateMarkdownSeo } from '../seo/markdown-seo';
import { hasPublicImage } from '@/shared/server/public-image';
import { postFrontmatterSchema, type PostFrontmatter } from './post-frontmatter-schema';
export { getPostPublishedDateTime } from '../model/post-index';

const POSTS_DIRECTORY = path.join(process.cwd(), 'content', 'posts');
const POST_FILE_EXTENSION = '.md';
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
