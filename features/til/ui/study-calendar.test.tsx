import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudyCalendar } from './study-calendar';

describe('StudyCalendar with hidden TIL content', () => {
  it('shows calendar topics without exposing article titles, summaries, or links', () => {
    const markup = renderToStaticMarkup(
      <StudyCalendar
        today="2026-11-01"
        entries={[
          {
            date: '2026-11-01',
            title: '숨길 일지 제목',
            description: '숨길 일지 요약',
            topics: ['보여줄 학습 주제'],
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Study Stamp"');
    expect(markup).not.toContain('한국 시간');
    expect(markup).not.toContain('Asia/Seoul');
    expect(markup).toContain('2026년 11월');
    expect(markup).toContain('aria-label="이전 달"');
    expect(markup).toContain('aria-label="다음 달"');
    expect(markup).toContain('이번 달');
    expect(markup).toContain('aria-current="date"');
    expect(markup).not.toContain('/til');
    expect(markup).not.toContain('TIL');
    expect(markup).not.toContain('TODAY I LEARNED');
    expect(markup).not.toContain('공부 일지');
    expect(markup).toContain('보여줄 학습 주제');
    expect(markup).not.toContain('일의 기록');
    expect(markup).toContain('data-recorded="true"');
    expect(markup).not.toContain('숨길 일지 제목');
    expect(markup).not.toContain('숨길 일지 요약');
  });

  it('opens the latest recorded month and accepts dates and topics without article metadata', () => {
    const markup = renderToStaticMarkup(
      <StudyCalendar today="2026-11-01" entries={[{ date: '2026-10-29', topics: ['변환 검증'] }]} />
    );

    expect(markup).toContain('2026년 10월');
    expect(markup).toContain('변환 검증');
    expect(markup).not.toContain('href=');
  });

  it('keeps all topics accessible in a keyboard-focusable recorded day', () => {
    const topics = ['긴 학습 주제의 전체 내용을 유지합니다', '마지막 주제'];
    const markup = renderToStaticMarkup(
      <StudyCalendar today="2026-11-02" entries={[{ date: '2026-11-02', topics }]} />
    );

    expect(markup).toContain('role="group" tabindex="0" aria-label="2026-11-02 학습 주제"');
    expect(markup).toContain('aria-label="학습 주제"');
    expect(markup).not.toContain(topics.join(', '));
    expect(markup).toContain(`>${topics[0]}</span>`);
    expect(markup).toContain(`>${topics[1]}</span>`);
    expect(markup.match(/<td\b/g)).toHaveLength(42);
  });
});
