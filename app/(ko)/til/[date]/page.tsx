import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAbsoluteUrl } from '@/shared/config/site-config';
import { getStudyEntry, getStudySummaries } from '@/features/til/server/study-repository';
import { MarkdownContent } from '@/features/posts/ui/post-view/markdown/markdown-content';
import styles from '@/features/til/ui/study-pages.module.css';

interface StudyPageProps {
  params: Promise<{ date: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getStudySummaries().map(entry => ({ date: entry.date }));
}

export async function generateMetadata({ params }: StudyPageProps): Promise<Metadata> {
  const { date } = await params;
  const entry = getStudyEntry(date);
  if (!entry) return {};
  const url = createAbsoluteUrl(`/til/${entry.date}`);
  return {
    title: `${entry.title} · ${entry.date} TIL`,
    description: entry.description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: entry.title, description: entry.description, url, tags: entry.topics },
  };
}

export default async function StudyPage({ params }: StudyPageProps) {
  const { date } = await params;
  const entry = getStudyEntry(date);
  if (!entry) notFound();
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/til">
        ← TIL 게시판
      </Link>
      <article className={styles.article}>
        <header className={`${styles.header} ${styles.articleHeader}`}>
          <p className={styles.eyebrow}>TODAY I LEARNED</p>
          <p className={styles.muted}>
            <time dateTime={entry.date}>{entry.date}</time> · 한국 시간 (Asia/Seoul)
          </p>
          <h1>{entry.title}</h1>
          <p className={styles.description}>{entry.description}</p>
          <ul className={styles.topics}>
            {entry.topics.map(topic => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </header>
        <MarkdownContent content={entry.content} title={entry.title} />
      </article>
      <Link className={styles.back} href="/">
        홈 달력으로 돌아가기 →
      </Link>
    </div>
  );
}
