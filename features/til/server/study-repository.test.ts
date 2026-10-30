import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStudyEntry, getStudySummaries, readStudyEntries } from './study-repository';

let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'til-test-'));
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function writeEntry(date: string, extra = '', filename = `${date}.md`) {
  fs.writeFileSync(
    path.join(directory, filename),
    `---\ndate: '${date}'\ntitle: '질문'\ndescription: '설명'\ntopics: ['주제']\n${extra}\n---\n본문`
  );
}

describe('study repository', () => {
  it('excludes draft and private entries before producing any public routes or summaries', () => {
    writeEntry('2026-10-29');
    writeEntry('2026-10-28', 'draft: true');
    writeEntry('2026-10-27', 'visibility: private');
    writeEntry('2026-10-30');
    expect(readStudyEntries(directory).map(entry => entry.date)).toEqual(['2026-10-30', '2026-10-29']);
  });

  it('fails clearly on an invalid calendar date or a filename/date mismatch', () => {
    writeEntry('2026-02-29');
    expect(() => readStudyEntries(directory)).toThrow('Invalid TIL frontmatter');
    fs.rmSync(path.join(directory, '2026-02-29.md'));
    writeEntry('2026-10-29', '', '2026-10-28.md');
    expect(() => readStudyEntries(directory)).toThrow('TIL filename must match its date');
  });

  it('supports a repository with no published entries', () => {
    expect(readStudyEntries(directory)).toEqual([]);
    expect(readStudyEntries(path.join(directory, 'missing'))).toEqual([]);
  });

  it('exposes the sample, omits full content from calendar data, and rejects invalid dates', () => {
    const summaries = getStudySummaries();
    expect(summaries.map(entry => entry.date)).toContain('2026-10-29');
    for (const summary of summaries) expect(summary).not.toHaveProperty('content');
    expect(getStudyEntry('2026-10-29')?.content).toBeTruthy();
    expect(getStudyEntry('2026-02-29')).toBeNull();
    expect(getStudyEntry('../2026-10-29')).toBeNull();
  });
});
