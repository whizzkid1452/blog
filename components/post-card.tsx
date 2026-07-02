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
      <PostLink href={`/posts/${post.slug}`}>
        <PostDate dateTime={post.date}>{post.date}</PostDate>
        <PostTitle>{post.title}</PostTitle>
        <PostDescription>{post.description}</PostDescription>
      </PostLink>
    </Article>
  );
}

const Article = styled.article`
  border-bottom: 1px solid #e4e4e7;
  padding: 24px 0;

  &:first-of-type {
    padding-top: 0;
  }
`;

const PostLink = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:hover h2 {
    color: #52525b;
  }
`;

const PostDate = styled.time`
  color: #71717a;
  font-size: 14px;
`;

const PostTitle = styled.h2`
  margin: 0;
  color: #18181b;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.25;
`;

const PostDescription = styled.p`
  margin: 0;
  color: #52525b;
  font-size: 16px;
  line-height: 1.75;
`;
