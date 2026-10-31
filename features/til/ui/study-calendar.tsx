'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import Link from 'next/link';
import { useState } from 'react';
import { IS_TIL_PUBLISHED } from '../config/til-publication';
import { formatStudyMonth, getStudyMonthWeeks, moveStudyMonth, type StudyEntrySummary } from '../model/study-entry';
import styles from './study-calendar.module.css';

interface StudyCalendarProps {
  entries: StudyEntrySummary[];
  today: string;
  title?: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function StudyCalendar({
  entries,
  today,
  title = IS_TIL_PUBLISHED ? '개발 공부 일지' : '캘린더',
}: StudyCalendarProps) {
  const publicEntries = IS_TIL_PUBLISHED ? entries : [];
  const [month, setMonth] = useState(() => (publicEntries[0]?.date ?? today).slice(0, 7));
  const entriesByDate = new Map(publicEntries.map(entry => [entry.date, entry]));
  const monthEntries = publicEntries.filter(entry => entry.date.startsWith(`${month}-`));
  const monthLabel = formatStudyMonth(month);

  return (
    <section className={styles.calendar} aria-label={title}>
      <div className={styles.heading}>
        <div>
          {IS_TIL_PUBLISHED && <p className={styles.eyebrow}>TODAY I LEARNED</p>}
          <h2>{title}</h2>
        </div>
        {IS_TIL_PUBLISHED && (
          <Link className={styles.boardLink} href="/til">
            TIL 게시판 <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>
      {IS_TIL_PUBLISHED && (
        <p className={styles.description}>무엇을 고민했고, 왜 그 선택을 했는지. 하루의 생각을 날짜로 모읍니다.</p>
      )}
      <div className={styles.toolbar}>
        <h3 aria-live="polite" aria-atomic="true">
          {monthLabel}
        </h3>
        <div className={styles.controls}>
          <button
            type="button"
            aria-label="이전 달"
            disabled={month === '0001-01'}
            onClick={() => setMonth(moveStudyMonth(month, -1))}
          >
            ←
          </button>
          <button type="button" onClick={() => setMonth(today.slice(0, 7))}>
            이번 달
          </button>
          <button
            type="button"
            aria-label="다음 달"
            disabled={month === '9999-12'}
            onClick={() => setMonth(moveStudyMonth(month, 1))}
          >
            →
          </button>
        </div>
      </div>
      {IS_TIL_PUBLISHED && (
        <p className={styles.hint}>
          날짜를 누르면 일지로 이동합니다. 마우스를 올리거나 키보드로 선택하면 요약을 볼 수 있어요.
        </p>
      )}
      <Tooltip.Provider delayDuration={200}>
        <table className={styles.month}>
          <caption className={styles.srOnly}>{monthLabel} 달력 · 한국 시간 기준</caption>
          <thead>
            <tr>
              {WEEKDAYS.map(day => (
                <th key={day} scope="col">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {getStudyMonthWeeks(month).map((week, index) => (
              <tr key={index}>
                {week.map((date, dayIndex) => {
                  const entry = date == null ? undefined : entriesByDate.get(date);
                  return (
                    <td key={date ?? `empty-${dayIndex}`} data-recorded={entry ? true : undefined}>
                      {date == null ? null : entry ? (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <Link
                              className={styles.dayLink}
                              href={`/til/${date}`}
                              aria-label={`${date} 공부 일지: ${entry.topics.join(', ')}`}
                              aria-current={date === today ? 'date' : undefined}
                            >
                              <time dateTime={date}>{Number(date.slice(-2))}</time>
                              <span className={styles.recordDot} aria-hidden="true" />
                              <ul className={styles.topics}>
                                {entry.topics.map(topic => (
                                  <li key={topic}>{topic}</li>
                                ))}
                              </ul>
                            </Link>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className={styles.preview} sideOffset={8} collisionPadding={16}>
                              <p className={styles.previewDate}>{date} · 공부 일지</p>
                              <p className={styles.previewTitle}>{entry.title}</p>
                              <p>{entry.description}</p>
                              <Tooltip.Arrow className={styles.previewArrow} />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      ) : (
                        <span className={styles.emptyDay} aria-current={date === today ? 'date' : undefined}>
                          <time dateTime={date}>{Number(date.slice(-2))}</time>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Tooltip.Provider>
      <div className={styles.footer}>
        {IS_TIL_PUBLISHED && <span>{monthEntries.length}일의 기록</span>}
        <span>한국 시간 · Asia/Seoul</span>
      </div>
      {IS_TIL_PUBLISHED &&
        (monthEntries.length === 0 ? (
          <p className={styles.empty} role="status">
            이 달에는 아직 공개된 공부 일지가 없습니다.
          </p>
        ) : (
          <ul className={styles.mobileAgenda} aria-label={`${monthLabel} 주제 목록`}>
            {monthEntries.map(entry => (
              <li key={entry.date}>
                <Link href={`/til/${entry.date}`}>
                  <time dateTime={entry.date}>{Number(entry.date.slice(-2))}일</time>
                  <ul>
                    {entry.topics.map(topic => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                  <span className={styles.agendaDescription}>{entry.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
