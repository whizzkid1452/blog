import { describe, expect, it } from 'vitest';
import { getKoreanToday, getStudyMonthWeeks, isStudyDate, moveStudyMonth } from './study-entry';

describe('study dates', () => {
  it('groups conversations by the Korean day at the UTC boundary', () => {
    expect(getKoreanToday(new Date('2026-10-28T14:59:59Z'))).toBe('2026-10-28');
    expect(getKoreanToday(new Date('2026-10-28T15:00:00Z'))).toBe('2026-10-29');
    expect(getKoreanToday(new Date('2026-10-29T14:59:59Z'))).toBe('2026-10-29');
    expect(getKoreanToday(new Date('2026-10-29T15:00:00Z'))).toBe('2026-10-30');
  });

  it('rejects impossible dates and noncanonical or path-like input', () => {
    expect(isStudyDate('2024-02-29')).toBe(true);
    for (const invalid of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-1', '../2026-10-29']) {
      expect(isStudyDate(invalid)).toBe(false);
    }
  });

  it('handles leap February, a six-week month, and year transitions', () => {
    expect(getStudyMonthWeeks('2024-02').flat().filter(Boolean)).toHaveLength(29);
    expect(getStudyMonthWeeks('2026-08')).toHaveLength(6);
    const october = getStudyMonthWeeks('2026-10');
    expect(october[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(october[4][4]).toBe('2026-10-29');
    expect(moveStudyMonth('2026-12', 1)).toBe('2027-01');
    expect(moveStudyMonth('2026-01', -1)).toBe('2025-12');
  });
});
