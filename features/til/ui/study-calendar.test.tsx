import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudyCalendar } from './study-calendar';

describe('study calendar navigation', () => {
  it('renders keyword-only days as text in both the grid and agenda while preserving article links', () => {
    const html = renderToStaticMarkup(
      createElement(StudyCalendar, {
        today: '2026-10-31',
        records: [
          { date: '2026-10-31', topics: ['학습 달력'], entry: null },
          {
            date: '2026-10-30',
            topics: ['검증 범위'],
            entry: {
              date: '2026-10-30',
              title: '실제로 무엇을 확인했을까?',
              description: '로컬 검증의 범위',
              topics: ['검증 범위'],
            },
          },
        ],
      })
    );
    expect(html.match(/학습 달력/g)).toHaveLength(2);
    expect(html).not.toContain('href="/til/2026-10-31"');
    expect(html.match(/href="\/til\/2026-10-30"/g)).toHaveLength(2);
    expect(html).toContain('2일의 기록');
  });
});
