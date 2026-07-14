import { HomeView } from '@/components/home-view';
import { getPostIndexForLocale } from '@/lib/post-translations';
import { createTagPageMetadata } from '@/lib/seo-metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface EnglishTagPageProps {
  params: Promise<{
    tag: string;
  }>;
}

export function generateStaticParams() {
  return getPostIndexForLocale('en')
    .getTags()
    .map(tag => ({ tag }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: EnglishTagPageProps): Promise<Metadata> {
  const { tag } = await params;

  if (!getPostIndexForLocale('en').getTags().includes(tag)) {
    return {};
  }

  return createTagPageMetadata(tag, { locale: 'en', hasAlternateLocale: true });
}

export default async function EnglishTagPage({ params }: EnglishTagPageProps) {
  const { tag } = await params;
  const postIndex = getPostIndexForLocale('en');

  if (!postIndex.getTags().includes(tag)) {
    notFound();
  }

  return (
    <HomeView
      locale="en"
      posts={postIndex.getPostSummariesByTag(tag)}
      eyebrow="Tag"
      title={`#${tag}`}
      description={`English posts tagged with ${tag}.`}
      emptyMessage={`No English posts tagged with ${tag}.`}
    />
  );
}
