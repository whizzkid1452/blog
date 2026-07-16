import type { PostSummary } from '../../model/post';

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
  return normalizeSearchText(
    [post.title, post.description, ...post.tags, post.series?.name].filter(value => value != null).join(' ')
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}
