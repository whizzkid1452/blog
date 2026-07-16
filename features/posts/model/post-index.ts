import type { Post, PostSummary } from './post';

const RELATED_POSTS_LIMIT = 3;

export interface PostSeries {
  name: string;
  posts: PostSummary[];
}

export class PostIndex {
  private readonly publishedPosts: Post[];
  private readonly publicPosts: Post[];

  constructor(posts: Post[]) {
    this.publishedPosts = posts.filter(post => !post.draft).sort(comparePosts);
    this.publicPosts = this.publishedPosts.filter(post => post.visibility === 'public');
  }

  getPostSummaries(): PostSummary[] {
    return this.publicPosts.map(toPostSummary);
  }

  getAuthenticatedPostSummaries(): PostSummary[] {
    return this.publishedPosts.filter(post => post.visibility === 'authenticated').map(toPostSummary);
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

  getSeries(): PostSeries[] {
    const postsBySeries = new Map<string, PostSummary[]>();

    this.getPostSummaries().forEach(post => {
      if (post.series == null) {
        return;
      }

      const seriesPosts = postsBySeries.get(post.series.name) ?? [];
      seriesPosts.push(post);
      postsBySeries.set(post.series.name, seriesPosts);
    });

    return Array.from(postsBySeries, ([name, posts]) => ({
      name,
      // 발행일과 읽기 순서는 다를 수 있으므로 frontmatter의 order를 우선한다.
      posts: posts.sort(compareSeriesPosts),
    })).sort((leftSeries, rightSeries) => leftSeries.name.localeCompare(rightSeries.name));
  }

  getPostBySlug(slug: string): Post | null {
    return this.publicPosts.find(post => post.slug === slug) ?? null;
  }

  getPostBySlugForAuthenticatedViewer(slug: string): Post | null {
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
    visibility: post.visibility,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt,
    series: post.series,
  };
}

function compareSeriesPosts(leftPost: PostSummary, rightPost: PostSummary): number {
  const orderComparison = (leftPost.series?.order ?? 0) - (rightPost.series?.order ?? 0);

  if (orderComparison !== 0) {
    return orderComparison;
  }

  return leftPost.slug.localeCompare(rightPost.slug);
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
