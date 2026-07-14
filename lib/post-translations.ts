import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import type { Locale } from './i18n';
import { createLocalizedPath } from './i18n';
import { validateMarkdownSeo } from './markdown-seo';
import { PostIndex } from './post-index';
import type { Post } from './posts';
import { getPostIndex } from './posts';

const ENGLISH_TRANSLATIONS_DIRECTORY = path.join(process.cwd(), 'content', 'post-translations', 'en');
const MARKDOWN_FILE_EXTENSION = '.md';

const postTranslationFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  coverAlt: z.string().trim().min(1).optional(),
  seriesName: z.string().trim().min(1).optional(),
});

export interface PostTranslation {
  title: string;
  description: string;
  content: string;
  coverAlt?: string;
  seriesName?: string;
}

interface ApplyPostTranslationParams {
  post: Post;
  translation: PostTranslation;
}

interface PostTranslationSource extends PostTranslation {
  fileName: string;
  slug: string;
}

let cachedEnglishPostIndex: PostIndex | null = null;

export function getPostIndexForLocale(locale: Locale): PostIndex {
  return locale === 'ko' ? getPostIndex() : getEnglishPostIndex();
}

export function hasEnglishPostTranslation(slug: string): boolean {
  return getEnglishPostIndex().getPostBySlugForAuthenticatedViewer(slug) != null;
}

export function applyPostTranslation({ post, translation }: ApplyPostTranslationParams): Post {
  const translatedSeries =
    post.series == null
      ? undefined
      : {
          ...post.series,
          name: translation.seriesName ?? post.series.name,
        };

  return {
    ...post,
    title: translation.title,
    description: translation.description,
    content: translation.content,
    coverAlt: translation.coverAlt ?? post.coverAlt,
    series: translatedSeries,
  };
}

export function isPostTranslationFileName(fileName: string): boolean {
  return path.extname(fileName) === MARKDOWN_FILE_EXTENSION;
}

function getEnglishPostIndex(): PostIndex {
  if (cachedEnglishPostIndex != null) {
    return cachedEnglishPostIndex;
  }

  const koreanPostIndex = getPostIndex();
  const translationSources = readPostTranslationSources();
  const translatedPosts = translationSources.map(source => {
    const koreanPost = koreanPostIndex.getPostBySlugForAuthenticatedViewer(source.slug);

    if (koreanPost == null) {
      throw new Error(`English translation has no published Korean post: ${source.fileName}`);
    }

    return applyPostTranslation({ post: koreanPost, translation: source });
  });

  validateEnglishPostMarkdown({ translationSources, translatedPosts, koreanPostIndex });
  cachedEnglishPostIndex = new PostIndex(translatedPosts);

  return cachedEnglishPostIndex;
}

function readPostTranslationSources(): PostTranslationSource[] {
  if (!fs.existsSync(ENGLISH_TRANSLATIONS_DIRECTORY)) {
    return [];
  }

  return fs
    .readdirSync(ENGLISH_TRANSLATIONS_DIRECTORY)
    .filter(isPostTranslationFileName)
    .sort()
    .map(readPostTranslationSource);
}

function readPostTranslationSource(fileName: string): PostTranslationSource {
  const fileContent = fs.readFileSync(path.join(ENGLISH_TRANSLATIONS_DIRECTORY, fileName), 'utf8');
  const { data, content } = matter(fileContent);
  const parseResult = postTranslationFrontmatterSchema.safeParse(data);

  if (!parseResult.success) {
    const message = parseResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid English translation frontmatter in ${fileName}: ${message}`);
  }

  return {
    fileName,
    slug: fileName.slice(0, -MARKDOWN_FILE_EXTENSION.length),
    ...parseResult.data,
    content: content.trim(),
  };
}

function validateEnglishPostMarkdown({
  translationSources,
  translatedPosts,
  koreanPostIndex,
}: {
  translationSources: PostTranslationSource[];
  translatedPosts: Post[];
  koreanPostIndex: PostIndex;
}): void {
  const internalRoutes = createInternalRouteSet({ translatedPosts, koreanPostIndex });

  translationSources.forEach(source =>
    validateMarkdownSeo({
      fileName: path.join('en', source.fileName),
      content: source.content,
      internalRoutes,
    })
  );
}

function createInternalRouteSet({
  translatedPosts,
  koreanPostIndex,
}: {
  translatedPosts: Post[];
  koreanPostIndex: PostIndex;
}): Set<string> {
  const routes = new Set<string>(['/', '/posts', '/en', '/en/posts']);

  [...koreanPostIndex.getPostSummaries(), ...koreanPostIndex.getAuthenticatedPostSummaries()].forEach(post => {
    routes.add(`/posts/${post.slug}`);
    post.tags.forEach(tag => routes.add(`/tags/${encodeURIComponent(tag)}`));
  });

  translatedPosts.forEach(post => {
    routes.add(createLocalizedPath('en', `/posts/${post.slug}`));
    post.tags.forEach(tag => routes.add(createLocalizedPath('en', `/tags/${encodeURIComponent(tag)}`)));
  });

  return routes;
}
