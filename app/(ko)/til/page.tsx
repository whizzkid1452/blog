import type { Metadata } from 'next';
import Link from 'next/link';
import { createAbsoluteUrl } from '@/shared/config/site-config';
import { getKoreanToday } from '@/features/til/model/study-entry';
import { getStudySummaries } from '@/features/til/server/study-repository';
import { StudyCalendar } from '@/features/til/ui/study-calendar';
import styles from '@/features/til/ui/study-pages.module.css';

export const metadata: Metadata = {
  title: 'TIL · 개발 공부 일지',
  description: '프로젝트의 요구사항부터 고민과 선택, 결론까지 날짜별로 모은 개발 공부 일지입니다.',
  alternates: { canonical: createAbsoluteUrl('/til') },
};

export default function TilPage() {
  const entries = getStudySummaries();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>LEARNING JOURNAL</p>
        <h1>TIL · 개발 공부 일지</h1>
        <p className={styles.description}>프로젝트의 요구사항에서 출발해, 고민과 선택의 이유를 남깁니다.</p>
      </header>
      <StudyCalendar entries={entries} today={getKoreanToday()} title="날짜로 돌아보기" />
      <section aria-labelledby="study-list-heading">
        <h2 id="study-list-heading">
          모든 일지 <span className={styles.muted}>· {entries.length}편</span>
        </h2>
        {entries.length === 0 ? (
          <p className={styles.description}>아직 공개된 공부 일지가 없습니다.</p>
        ) : (
          <ol className={styles.list}>
            {entries.map(entry => (
              <li key={entry.date}>
                <Link className={styles.entry} href={`/til/${entry.date}`}>
                  <time dateTime={entry.date}>{entry.date} · 한국 시간</time>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                  <ul className={styles.topics}>
                    {entry.topics.map(topic => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
