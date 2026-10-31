'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import Link from 'next/link';
import { useState } from 'react';
import { formatStudyMonth, getStudyMonthWeeks, moveStudyMonth, type StudyCalendarRecord } from '../model/study-entry';
import styles from './study-calendar.module.css';

interface StudyCalendarProps {
  records: StudyCalendarRecord[];
  today: string;
  title?: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function StudyCalendar({ records, today, title = '개발 공부 일지' }: StudyCalendarProps) {
  const [month, setMonth] = useState(() => (records[0]?.date ?? today).slice(0, 7));
  const recordsByDate = new Map(records.map(record => [record.date, record]));
  const monthRecords = records.filter(record => record.date.startsWith(`${month}-`));
  const monthLabel = formatStudyMonth(month);

  return (
    <section className={styles.calendar} aria-label={title}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>TODAY I LEARNED</p>
          <h2>{title}</h2>
        </div>
        <Link className={styles.boardLink} href="/til">
          TIL 게시판 <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <p className={styles.description}>무엇을 고민했고, 왜 그 선택을 했는지. 하루의 생각을 날짜로 모읍니다.</p>
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
      <p className={styles.hint}>
        날짜별로 다룬 키워드를 모았습니다. 밑줄이 있는 날짜는 일지로 연결되며, 마우스를 올리거나 키보드로 선택하면
        요약을 볼 수 있어요.
      </p>
      <Tooltip.Provider delayDuration={200}>
        <table className={styles.month}>
          <caption className={styles.srOnly}>{monthLabel} 공부 일지 달력 · 한국 시간 기준</caption>
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
                  const record = date == null ? undefined : recordsByDate.get(date);
                  return (
                    <td key={date ?? `empty-${dayIndex}`} data-recorded={record ? true : undefined}>
                      {date == null ? null : record ? (
                        <RecordedDay record={record} today={today} />
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
        <span>{monthRecords.length}일의 기록</span>
        <span>한국 시간 · Asia/Seoul</span>
      </div>
      {monthRecords.length === 0 ? (
        <p className={styles.empty} role="status">
          이 달에는 아직 기록된 키워드나 일지가 없습니다.
        </p>
      ) : (
        <ul className={styles.mobileAgenda} aria-label={`${monthLabel} 주제 목록`}>
          {monthRecords.map(record => {
            const content = (
              <>
                <time dateTime={record.date}>{Number(record.date.slice(-2))}일</time>
                <ul>
                  {record.topics.map(topic => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
                {record.entry ? <span className={styles.agendaDescription}>{record.entry.description}</span> : null}
              </>
            );
            return (
              <li key={record.date}>
                {record.entry ? (
                  <Link href={`/til/${record.date}`}>{content}</Link>
                ) : (
                  <div className={styles.keywordAgenda}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecordedDay({ record, today }: { record: StudyCalendarRecord; today: string }) {
  const { date, topics, entry } = record;
  const content = (
    <>
      <time dateTime={date}>{Number(date.slice(-2))}</time>
      <span className={styles.recordDot} aria-hidden="true" />
      <ul className={styles.topics}>
        {topics.map(topic => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
    </>
  );

  if (!entry) {
    return (
      <div className={styles.keywordDay} aria-current={date === today ? 'date' : undefined}>
        {content}
      </div>
    );
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Link
          className={styles.dayLink}
          href={`/til/${date}`}
          aria-label={`${date} 공부 일지: ${topics.join(', ')}`}
          aria-current={date === today ? 'date' : undefined}
        >
          {content}
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
  );
}
