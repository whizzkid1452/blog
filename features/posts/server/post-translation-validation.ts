import path from 'node:path';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import type { Post } from '../model/post';
import type { PostIndex } from '../model/post-index';
import { validateMarkdownSeo } from '../seo/markdown-seo';
import type { PostTranslationSource } from './post-translation-model';

export function validateEnglishPostMarkdown({
  translationSources,
  translatedPosts,
  koreanPostIndex,
}: {
  translationSources: PostTranslationSource[];
  translatedPosts: Post[];
  koreanPostIndex: PostIndex;
}): void {
  const internalRoutes = createInternalRouteSet({ translatedPosts, koreanPostIndex });

  translationSources.forEach(source =>
    validateMarkdownSeo({
      fileName: path.join('en', source.fileName),
      content: source.content,
      internalRoutes,
    })
  );
}

function createInternalRouteSet({
  translatedPosts,
  koreanPostIndex,
}: {
  translatedPosts: Post[];
  koreanPostIndex: PostIndex;
}): Set<string> {
  const routes = new Set<string>(['/', '/posts', '/en', '/en/posts']);

  [...koreanPostIndex.getPostSummaries(), ...koreanPostIndex.getAuthenticatedPostSummaries()].forEach(post => {
    routes.add(`/posts/${post.slug}`);
    post.tags.forEach(tag => routes.add(`/tags/${encodeURIComponent(tag)}`));
  });

  translatedPosts.forEach(post => {
    routes.add(createLocalizedPath('en', `/posts/${post.slug}`));
    post.tags.forEach(tag => routes.add(createLocalizedPath('en', `/tags/${encodeURIComponent(tag)}`)));
  });

  return routes;
}
