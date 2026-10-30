import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { isStudyDate, type StudyEntry, type StudyEntrySummary } from '../model/study-entry';

const entrySchema = z.object({
  date: z.string().refine(isStudyDate, 'Expected a valid YYYY-MM-DD date in Asia/Seoul'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  topics: z.array(z.string().trim().min(1)).min(1),
  draft: z.boolean().default(false),
  visibility: z.enum(['public', 'private']).default('public'),
});

export function readStudyEntries(directory = path.join(process.cwd(), 'content', 'til')): StudyEntry[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter(file => file.endsWith('.md'))
    .sort()
    .flatMap(file => {
      const { data, content } = matter(fs.readFileSync(path.join(directory, file), 'utf8'));
      const result = entrySchema.safeParse(data);
      if (!result.success) throw new Error(`Invalid TIL frontmatter in ${file}: ${result.error.message}`);
      const { draft, visibility, ...summary } = result.data;
      if (file !== `${summary.date}.md`) throw new Error(`TIL filename must match its date: ${file}`);
      if (draft || visibility !== 'public') return [];
      return [{ ...summary, content: content.trim() }];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getStudySummaries(): StudyEntrySummary[] {
  return readStudyEntries().map(({ date, title, description, topics }) => ({ date, title, description, topics }));
}

export function getStudyEntry(date: string): StudyEntry | null {
  if (!isStudyDate(date)) return null;
  return readStudyEntries().find(entry => entry.date === date) ?? null;
}
