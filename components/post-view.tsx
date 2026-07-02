'use client';

import type { Post } from '@/lib/posts';
import styled from '@emotion/styled';
import Link from 'next/link';
import { MarkdownContent } from './markdown-content';

interface PostViewProps {
  post: Post;
}

export function PostView({ post }: PostViewProps) {
  return (
    <PageShell>
      <Article>
        <Header>
          <PostDate dateTime={post.date}>{post.date}</PostDate>
          <Title>{post.title}</Title>
          {post.description == null ? null : <Description>{post.description}</Description>}
          <TagList aria-label="Tags">
            {post.tags.map(tag => (
              <TagLink key={tag} href={`/tags/${encodeURIComponent(tag)}`} rel="noopener noreferrer" target="_blank">
                #{tag}
              </TagLink>
            ))}
          </TagList>
        </Header>
        <MarkdownContent content={post.content} title={post.title} />
      </Article>
    </PageShell>
  );
}

const PageShell = styled.main`
  display: flex;
  width: min(100%, 768px);
  flex-direction: column;
  gap: 40px;
  margin: 0 auto;
  padding: 96px 24px;

  @media (max-width: 640px) {
    padding: 64px 20px;
  }
`;

const Article = styled.article`
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 32px;
`;

const PostDate = styled.time`
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
`;

const Title = styled.h1`
  margin: 0;
  color: var(--color-text-primary);
  font-size: 40px;
  font-weight: 650;
  line-height: 1.15;
`;

const Description = styled.p`
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 18px;
  line-height: 1.75;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const TagLink = styled(Link)`
  color: var(--color-link);
  font-size: 14px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
`;
