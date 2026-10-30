import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { createHomeMetadata } from '@/features/posts/seo/seo-metadata';
import type { Metadata } from 'next';
import { getStudySummaries } from '@/features/til/server/study-repository';
import { getKoreanToday } from '@/features/til/model/study-entry';
import { StudyCalendar } from '@/features/til/ui/study-calendar';

export const metadata: Metadata = createHomeMetadata();

export default function Home() {
  const posts = getPostIndex().getFeaturedPostSummaries();

  return (
    <PostListView
      posts={posts}
      eyebrow="대표 글"
      beforePosts={<StudyCalendar entries={getStudySummaries()} today={getKoreanToday()} />}
    />
  );
}
