import type { Post } from '../model/post';

export interface PostTranslation {
  title: string;
  description: string;
  content: string;
  coverAlt?: string;
  seriesName?: string;
}

export interface PostTranslationSource extends PostTranslation {
  fileName: string;
  slug: string;
}

export function applyPostTranslation({ post, translation }: { post: Post; translation: PostTranslation }): Post {
  const translatedSeries =
    post.series == null
      ? undefined
      : {
          ...post.series,
          name: translation.seriesName ?? post.series.name,
        };

  return {
    ...post,
    title: translation.title,
    description: translation.description,
    content: translation.content,
    coverAlt: translation.coverAlt ?? post.coverAlt,
    series: translatedSeries,
  };
}
