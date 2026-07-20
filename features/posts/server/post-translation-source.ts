import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import type { PostTranslationSource } from './post-translation-model';

const ENGLISH_TRANSLATIONS_DIRECTORY = path.join(process.cwd(), 'content', 'post-translations', 'en');
const MARKDOWN_FILE_EXTENSION = '.md';

const postTranslationFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  coverAlt: z.string().trim().min(1).optional(),
  seriesName: z.string().trim().min(1).optional(),
});

export function isPostTranslationFileName(fileName: string): boolean {
  return path.extname(fileName) === MARKDOWN_FILE_EXTENSION;
}

export function readPostTranslationSources(): PostTranslationSource[] {
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
