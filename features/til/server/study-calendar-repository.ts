import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { isStudyDate, type StudyCalendarRecord, type StudyKeywords } from '../model/study-entry';
import { getStudySummaries } from './study-repository';

const keywordsSchema = z.array(
  z
    .object({
      date: z.string().refine(isStudyDate, 'Expected a valid YYYY-MM-DD date in Asia/Seoul'),
      topics: z.array(z.string().trim().min(1)).min(1).max(6),
    })
    .strict()
);

export function readStudyKeywords(
  filePath = path.join(process.cwd(), 'content', 'study-keywords.json')
): StudyKeywords[] {
  if (!fs.existsSync(filePath)) return [];
  const records = keywordsSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  const dates = new Set<string>();
  for (const record of records) {
    if (dates.has(record.date)) throw new Error(`Duplicate study keyword date: ${record.date}`);
    if (new Set(record.topics).size !== record.topics.length) {
      throw new Error(`Duplicate study keyword topic: ${record.date}`);
    }
    dates.add(record.date);
  }
  return records;
}

export function getStudyCalendarRecords(keywordsFilePath?: string): StudyCalendarRecord[] {
  const records = new Map<string, StudyCalendarRecord>(
    readStudyKeywords(keywordsFilePath).map(record => [record.date, { ...record, entry: null }])
  );
  for (const entry of getStudySummaries()) {
    records.set(entry.date, { date: entry.date, topics: entry.topics, entry });
  }
  return [...records.values()].sort((a, b) => b.date.localeCompare(a.date));
}
