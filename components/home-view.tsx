'use client';

import type { PostSummary } from '@/lib/posts';
import styled from '@emotion/styled';
import { PostCard } from './post-card';

interface HomeViewProps {
  posts: PostSummary[];
  eyebrow?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

export function HomeView({
  posts,
  eyebrow = 'Personal notes',
  title = 'Blog',
  description = 'Essays, engineering notes, and implementation logs.',
  emptyMessage = 'No posts published yet.',
}: HomeViewProps) {
  return (
    <PageShell>
      <Header>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Title>{title}</Title>
        <Description>{description}</Description>
      </Header>

      {posts.length > 0 ? (
        <PostList aria-label="Posts">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </PostList>
      ) : (
        <EmptyMessage>{emptyMessage}</EmptyMessage>
      )}
    </PageShell>
  );
}

const PageShell = styled.main`
  display: flex;
  width: min(100%, 768px);
  flex-direction: column;
  gap: 48px;
  margin: 0 auto;
  padding: 96px 24px;

  @media (max-width: 640px) {
    padding: 64px 20px;
  }
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Eyebrow = styled.p`
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
`;

const Title = styled.h1`
  margin: 0;
  color: var(--color-text-primary);
  font-size: 48px;
  font-weight: 650;
  line-height: 1.08;

  @media (max-width: 640px) {
    font-size: 40px;
  }
`;

const Description = styled.p`
  max-width: 640px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 18px;
  line-height: 1.75;
`;

const PostList = styled.section`
  display: flex;
  flex-direction: column;
`;

const EmptyMessage = styled.p`
  margin: 0;
  color: var(--color-text-muted);
  font-size: 16px;
  line-height: 1.75;
`;
