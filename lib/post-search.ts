import type { PostSummary } from './posts';

interface SearchPostSummariesOptions {
  posts: PostSummary[];
  query: string;
}

export function searchPostSummaries({ posts, query }: SearchPostSummariesOptions): PostSummary[] {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery.length === 0) {
    return posts;
  }

  return posts.filter(post => createSearchableText(post).includes(normalizedQuery));
}

function createSearchableText(post: PostSummary): string {
  // 정적 페이지의 클라이언트 전송량을 제한하기 위해 본문 대신 요약 메타데이터만 검색한다.
  return normalizeSearchText(
    [post.title, post.description, ...post.tags, post.series?.name].filter(value => value != null).join(' ')
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}
