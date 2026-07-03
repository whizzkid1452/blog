'use client';

import type { Post, PostSummary } from '@/lib/posts';
import styled from '@emotion/styled';
import Link from 'next/link';
import { MarkdownContent } from './markdown-content';

interface PostViewProps {
  post: Post;
  relatedPosts: PostSummary[];
}

export function PostView({ post, relatedPosts }: PostViewProps) {
  return (
    <PageShell>
      <Article>
        <Header>
          <PostDate dateTime={post.date}>{post.date}</PostDate>
          <Title>{post.title}</Title>
          {post.description == null ? null : <Description>{post.description}</Description>}
          <TagList aria-label="Tags">
            {post.tags.map(tag => (
              <TagLink key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                #{tag}
              </TagLink>
            ))}
          </TagList>
        </Header>
        <MarkdownContent content={post.content} title={post.title} />
      </Article>
      {relatedPosts.length > 0 ? (
        <RelatedSection aria-labelledby="related-posts-title">
          <RelatedTitle id="related-posts-title">Related posts</RelatedTitle>
          <RelatedList>
            {relatedPosts.map(relatedPost => (
              <RelatedItem key={relatedPost.slug}>
                <RelatedLink href={`/posts/${relatedPost.slug}`}>{relatedPost.title}</RelatedLink>
                <RelatedMeta>
                  <time dateTime={relatedPost.date}>{relatedPost.date}</time>
                  <span>{relatedPost.tags.map(tag => `#${tag}`).join(' ')}</span>
                </RelatedMeta>
              </RelatedItem>
            ))}
          </RelatedList>
        </RelatedSection>
      ) : null}
    </PageShell>
  );
}

const PageShell = styled.div`
  display: flex;
  width: min(100%, 768px);
  flex-direction: column;
  gap: 40px;
  margin: 0 auto;

  @media (max-width: 640px) {
    gap: 32px;
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

const RelatedSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid var(--color-border);
  padding-top: 32px;
`;

const RelatedTitle = styled.h2`
  margin: 0;
  color: var(--color-text-primary);
  font-size: 22px;
  font-weight: 650;
  line-height: 1.3;
`;

const RelatedList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const RelatedItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const RelatedLink = styled(Link)`
  color: var(--color-text-primary);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.45;
  text-decoration: none;

  &:hover {
    color: var(--color-link-hover);
  }
`;

const RelatedMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
`;
