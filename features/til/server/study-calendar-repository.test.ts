import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStudyCalendarRecords, readStudyKeywords } from './study-calendar-repository';

vi.mock('./study-repository', () => ({
  getStudySummaries: () => [
    { date: '2026-10-30', title: '검증 범위', description: '확인한 동작', topics: ['로컬 검증'] },
    { date: '2026-10-29', title: '저장 구조', description: '저장 경로', topics: ['Local-first'] },
  ],
}));

let directory: string;
let keywordsFilePath: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'study-keywords-'));
  keywordsFilePath = path.join(directory, 'keywords.json');
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('study calendar records', () => {
  it('keeps keywords without an article and gives a published article priority on overlapping dates', () => {
    fs.writeFileSync(
      keywordsFilePath,
      JSON.stringify([
        { date: '2026-10-23', topics: ['queueMicrotask'] },
        { date: '2026-10-30', topics: ['임시 키워드'] },
      ])
    );
    const records = getStudyCalendarRecords(keywordsFilePath);
    expect(records.map(record => record.date)).toEqual(['2026-10-30', '2026-10-29', '2026-10-23']);
    expect(records[0].entry?.date).toBe('2026-10-30');
    expect(records[0].topics).not.toContain('임시 키워드');
    expect(records[2]).toEqual({ date: '2026-10-23', topics: ['queueMicrotask'], entry: null });
  });

  it('rejects invalid dates, duplicate dates, duplicate topics, and accidental article fields', () => {
    const invalidRecords = [
      [{ date: '2026-02-29', topics: ['날짜 오류'] }],
      [
        { date: '2026-10-23', topics: ['중복'] },
        { date: '2026-10-23', topics: ['다른 주제'] },
      ],
      [{ date: '2026-10-23', topics: ['중복', '중복'] }],
      [{ date: '2026-10-23', topics: ['키워드'], content: '본문을 만들지 않습니다.' }],
    ];
    for (const records of invalidRecords) {
      fs.writeFileSync(keywordsFilePath, JSON.stringify(records));
      expect(() => readStudyKeywords(keywordsFilePath)).toThrow();
    }
  });

  it('supports missing keyword data and validates the curated local history data', () => {
    expect(readStudyKeywords(keywordsFilePath)).toEqual([]);
    const records = readStudyKeywords();
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(record => Object.keys(record).sort().join(',') === 'date,topics')).toBe(true);
  });
});
