import type { Locale } from '@/shared/i18n/i18n';
import { PostIndex } from '../model/post-index';
import { getPostIndex } from './post-repository';
import { applyPostTranslation } from './post-translation-model';
import { readPostTranslationSources } from './post-translation-source';
import { validateEnglishPostMarkdown } from './post-translation-validation';

export { applyPostTranslation } from './post-translation-model';
export type { PostTranslation } from './post-translation-model';
export { isPostTranslationFileName } from './post-translation-source';

let cachedEnglishPostIndex: PostIndex | null = null;

export function getPostIndexForLocale(locale: Locale): PostIndex {
  return locale === 'ko' ? getPostIndex() : getEnglishPostIndex();
}

export function hasEnglishPostTranslation(slug: string): boolean {
  return getEnglishPostIndex().getPostBySlugForAuthenticatedViewer(slug) != null;
}

function getEnglishPostIndex(): PostIndex {
  if (cachedEnglishPostIndex != null) {
    return cachedEnglishPostIndex;
  }

  const koreanPostIndex = getPostIndex();
  const translationSources = readPostTranslationSources();
  const translatedPosts = translationSources.map(source => {
    const koreanPost = koreanPostIndex.getPostBySlugForAuthenticatedViewer(source.slug);

    if (koreanPost == null) {
      throw new Error(`English translation has no published Korean post: ${source.fileName}`);
    }

    return applyPostTranslation({ post: koreanPost, translation: source });
  });

  validateEnglishPostMarkdown({ translationSources, translatedPosts, koreanPostIndex });
  cachedEnglishPostIndex = new PostIndex(translatedPosts);

  return cachedEnglishPostIndex;
}
