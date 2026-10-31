import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudyCalendar } from './study-calendar';

describe('StudyCalendar with hidden TIL content', () => {
  it('keeps the calendar and month controls without exposing journal content or links', () => {
    const markup = renderToStaticMarkup(
      <StudyCalendar
        today="2026-11-01"
        entries={[
          {
            date: '2026-11-01',
            title: '숨길 일지 제목',
            description: '숨길 일지 요약',
            topics: ['숨길 학습 주제'],
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="캘린더"');
    expect(markup).toContain('2026년 11월');
    expect(markup).toContain('aria-label="이전 달"');
    expect(markup).toContain('aria-label="다음 달"');
    expect(markup).toContain('이번 달');
    expect(markup).toContain('aria-current="date"');
    expect(markup).not.toContain('/til');
    expect(markup).not.toContain('TIL');
    expect(markup).not.toContain('TODAY I LEARNED');
    expect(markup).not.toContain('공부 일지');
    expect(markup).not.toContain('숨길');
    expect(markup).not.toContain('data-recorded');
  });
});
