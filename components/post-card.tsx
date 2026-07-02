'use client';

import type { PostSummary } from '@/lib/posts';
import styled from '@emotion/styled';
import Link from 'next/link';

interface PostCardProps {
  post: PostSummary;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Article>
      <PostMeta>
        <PostDate dateTime={post.date}>{post.date}</PostDate>
        <TagList aria-label="Tags">
          {post.tags.map(tag => (
            <TagLink key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
              #{tag}
            </TagLink>
          ))}
        </TagList>
      </PostMeta>
      <PostTitle>
        <PostLink href={`/posts/${post.slug}`}>{post.title}</PostLink>
      </PostTitle>
      {post.description == null ? null : <PostDescription>{post.description}</PostDescription>}
    </Article>
  );
}

const Article = styled.article`
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  padding: 24px 0;

  &:first-of-type {
    padding-top: 0;
  }
`;

const PostMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
`;

const PostDate = styled.time`
  color: var(--color-text-muted);
  font-size: 14px;
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

const PostTitle = styled.h2`
  margin: 0;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.25;
`;

const PostLink = styled(Link)`
  color: var(--color-text-primary);
  text-decoration: none;

  &:hover {
    color: var(--color-link-hover);
  }
`;

const PostDescription = styled.p`
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1.75;
`;
