'use client';

import type { BlogComment } from '../../model/comment-types';
import { createCommentsApiClient } from '../../client/comments-api-client';
import type { Locale } from '@/shared/i18n/i18n';
import { useEffect, useState } from 'react';
import { COMMENT_MESSAGES } from './comment-messages';

interface UseCommentsParams {
  locale: Locale;
  postSlug: string;
}

export interface CommentsState {
  authorName: string;
  comments: BlogComment[];
  content: string;
  isLoading: boolean;
  isSubmitting: boolean;
  loadError: string | null;
  submitError: string | null;
  setAuthorName: (authorName: string) => void;
  setContent: (content: string) => void;
  submitComment: () => Promise<void>;
  retry: () => void;
}

export function useComments({ locale, postSlug }: UseCommentsParams): CommentsState {
  const messages = COMMENT_MESSAGES[locale];
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [loadRequest, setLoadRequest] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const commentsApiClient = createCommentsApiClient({ postSlug });

    async function loadComments() {
      try {
        setComments(await commentsApiClient.list(abortController.signal));
        setLoadError(null);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        setLoadError(messages.loadError);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadComments();

    return () => {
      abortController.abort();
    };
  }, [loadRequest, messages.loadError, postSlug]);

  async function submitComment() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const commentsApiClient = createCommentsApiClient({ postSlug });
      const comment = await commentsApiClient.create({ authorName, content });

      setComments(currentComments => [...currentComments, comment]);
      setContent('');
    } catch {
      setSubmitError(messages.submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function retry() {
    setIsLoading(true);
    setLoadRequest(currentRequest => currentRequest + 1);
  }

  return {
    authorName,
    comments,
    content,
    isLoading,
    isSubmitting,
    loadError,
    submitError,
    setAuthorName,
    setContent,
    submitComment,
    retry,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
