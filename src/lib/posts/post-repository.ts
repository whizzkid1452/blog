import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import matter from 'gray-matter';
import { parsePostFrontmatter, type PostFrontmatter } from './post-schema';

const POST_FILE_EXTENSION = '.mdx';
const DEFAULT_POSTS_DIRECTORY = join(process.cwd(), 'src', 'content', 'posts');

export type Post = PostFrontmatter & {
  slug: string;
  body: string;
};

export type PostRepositoryOptions = {
  postsDirectory?: string;
};

export type GetPostBySlugOptions = PostRepositoryOptions & {
  slug: string;
};

export async function getAllPosts(options: PostRepositoryOptions = {}) {
  const postsDirectory = resolvePostsDirectory(options);
  const fileNames = await getPostFileNames(postsDirectory);
  const posts = await Promise.all(fileNames.map(fileName => readPostFile({ postsDirectory, fileName })));

  return posts.sort(comparePostsByPublishedDate);
}

export async function getPublishedPosts(options: PostRepositoryOptions = {}) {
  const posts = await getAllPosts(options);
  return posts.filter(post => !post.draft);
}

export async function getPostBySlug(options: GetPostBySlugOptions) {
  const posts = await getAllPosts(options);
  return posts.find(post => post.slug === options.slug) ?? null;
}

function resolvePostsDirectory({ postsDirectory }: PostRepositoryOptions) {
  return postsDirectory ?? DEFAULT_POSTS_DIRECTORY;
}

async function getPostFileNames(postsDirectory: string) {
  try {
    const fileNames = await readdir(postsDirectory);
    return fileNames.filter(isPostFileName).sort();
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

async function readPostFile({ postsDirectory, fileName }: { postsDirectory: string; fileName: string }) {
  const fileContent = await readFile(join(postsDirectory, fileName), 'utf8');
  const { data, content } = matter(fileContent);
  const frontmatter = parsePostFrontmatter({ fileName, frontmatter: data });

  return {
    slug: createSlug(fileName),
    ...frontmatter,
    body: normalizePostBody(content),
  };
}

function isPostFileName(fileName: string) {
  return extname(fileName) === POST_FILE_EXTENSION;
}

function createSlug(fileName: string) {
  return basename(fileName, POST_FILE_EXTENSION);
}

function normalizePostBody(content: string) {
  return content.trimStart();
}

function comparePostsByPublishedDate(firstPost: Post, secondPost: Post) {
  const dateComparison = secondPost.publishedAt.localeCompare(firstPost.publishedAt);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return firstPost.slug.localeCompare(secondPost.slug);
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
