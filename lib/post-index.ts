import type { Post, PostSummary } from './posts';

const RELATED_POSTS_LIMIT = 3;

export class PostIndex {
  private readonly publishedPosts: Post[];

  constructor(posts: Post[]) {
    this.publishedPosts = posts.filter(post => !post.draft).sort(comparePosts);
  }

  getPostSummaries(): PostSummary[] {
    return this.publishedPosts.map(toPostSummary);
  }

  getPostSummariesByTag(tag: string): PostSummary[] {
    return this.getPostSummaries().filter(post => post.tags.includes(tag));
  }

  getRelatedPostSummaries(post: Pick<Post, 'slug' | 'tags'>): PostSummary[] {
    const tagSet = new Set(post.tags);

    return this.getPostSummaries()
      .filter(candidate => candidate.slug !== post.slug)
      .map(candidate => ({
        post: candidate,
        sharedTagCount: candidate.tags.filter(tag => tagSet.has(tag)).length,
      }))
      .filter(candidate => candidate.sharedTagCount > 0)
      .sort(compareRelatedPosts)
      .slice(0, RELATED_POSTS_LIMIT)
      .map(candidate => candidate.post);
  }

  getTags(): string[] {
    return Array.from(new Set(this.getPostSummaries().flatMap(post => post.tags))).sort((leftTag, rightTag) =>
      leftTag.localeCompare(rightTag)
    );
  }

  getPostBySlug(slug: string): Post | null {
    return this.publishedPosts.find(post => post.slug === slug) ?? null;
  }
}

export function getPostPublishedDateTime(post: Pick<Post, 'date' | 'publishedAt'>): string {
  return post.publishedAt ?? `${post.date}T00:00:00.000Z`;
}

function toPostSummary(post: Post): PostSummary {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    date: post.date,
    publishedAt: post.publishedAt,
    tags: post.tags,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt,
  };
}

function comparePosts(leftPost: Post, rightPost: Post): number {
  const publishTimeComparison = getPostPublishTime(rightPost) - getPostPublishTime(leftPost);

  if (publishTimeComparison !== 0) {
    return publishTimeComparison;
  }

  return leftPost.slug.localeCompare(rightPost.slug);
}

function compareRelatedPosts(
  leftPost: { post: PostSummary; sharedTagCount: number },
  rightPost: { post: PostSummary; sharedTagCount: number }
): number {
  const sharedTagCountComparison = rightPost.sharedTagCount - leftPost.sharedTagCount;

  if (sharedTagCountComparison !== 0) {
    return sharedTagCountComparison;
  }

  const publishTimeComparison = getPostPublishTime(rightPost.post) - getPostPublishTime(leftPost.post);

  if (publishTimeComparison !== 0) {
    return publishTimeComparison;
  }

  return leftPost.post.slug.localeCompare(rightPost.post.slug);
}

function getPostPublishTime(post: Pick<Post, 'date' | 'publishedAt'>): number {
  return new Date(getPostPublishedDateTime(post)).getTime();
}
