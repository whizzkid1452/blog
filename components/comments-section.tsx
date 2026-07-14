'use client';

import {
  COMMENT_AUTHOR_NAME_MAX_LENGTH,
  COMMENT_CONTENT_MAX_LENGTH,
  commentCreateResponseSchema,
  commentListResponseSchema,
} from '@/lib/comments/comment-schema';
import type { BlogComment } from '@/lib/comments/comment-types';
import type { Locale } from '@/lib/i18n';
import { useEffect, useState, type FormEvent } from 'react';
import styles from './comments-section.module.css';

interface CommentMessages {
  authorLabel: string;
  authorPlaceholder: string;
  commentsTitle: string;
  contentLabel: string;
  contentPlaceholder: string;
  empty: string;
  loadError: string;
  loading: string;
  privacyNotice: string;
  retry: string;
  submit: string;
  submitError: string;
  submitting: string;
}

const COMMENT_MESSAGES: Record<Locale, CommentMessages> = {
  ko: {
    authorLabel: '닉네임',
    authorPlaceholder: '닉네임',
    commentsTitle: '댓글',
    contentLabel: '댓글',
    contentPlaceholder: '의견을 남겨 주세요.',
    empty: '아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.',
    loadError: '댓글을 불러오지 못했습니다.',
    loading: '댓글을 불러오는 중입니다…',
    privacyNotice: '닉네임과 댓글은 공개됩니다.',
    retry: '다시 시도',
    submit: '댓글 등록',
    submitError: '댓글을 저장하지 못했습니다.',
    submitting: '등록 중…',
  },
  en: {
    authorLabel: 'Name',
    authorPlaceholder: 'Display name',
    commentsTitle: 'Comments',
    contentLabel: 'Comment',
    contentPlaceholder: 'Share your thoughts.',
    empty: 'No comments yet. Be the first to comment.',
    loadError: 'Comments could not be loaded.',
    loading: 'Loading comments…',
    privacyNotice: 'Your display name and comment will be public.',
    retry: 'Try again',
    submit: 'Post comment',
    submitError: 'Your comment could not be saved.',
    submitting: 'Posting…',
  },
};

const COMMENT_DATE_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ko: new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }),
  en: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
};

interface CommentsSectionProps {
  locale: Locale;
  postSlug: string;
}

export function CommentsSection({ locale, postSlug }: CommentsSectionProps) {
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

    async function loadComments() {
      try {
        const response = await fetch(createCommentsApiPath(postSlug), {
          cache: 'no-store',
          signal: abortController.signal,
        });
        const responseBody = await readResponseBody(response);

        if (!response.ok) {
          throw new Error(messages.loadError);
        }

        const parsedResponse = commentListResponseSchema.safeParse(responseBody);

        if (!parsedResponse.success) {
          throw new Error(messages.loadError);
        }

        setComments(parsedResponse.data.comments);
        setLoadError(null);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : messages.loadError);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(createCommentsApiPath(postSlug), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authorName, content }),
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(messages.submitError);
      }

      const parsedResponse = commentCreateResponseSchema.safeParse(responseBody);

      if (!parsedResponse.success) {
        throw new Error(messages.submitError);
      }

      setComments(currentComments => [...currentComments, parsedResponse.data.comment]);
      setContent('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : messages.submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetry() {
    setIsLoading(true);
    setLoadRequest(currentRequest => currentRequest + 1);
  }

  return (
    <section className={styles.section} aria-labelledby="comments-title">
      <header className={styles.header}>
        <h2 className={styles.title} id="comments-title">
          {messages.commentsTitle} <span className={styles.count}>{comments.length}</span>
        </h2>
        <p className={styles.description}>{messages.privacyNotice}</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>{messages.authorLabel}</span>
          <input
            className={styles.input}
            maxLength={COMMENT_AUTHOR_NAME_MAX_LENGTH}
            name="authorName"
            onChange={event => setAuthorName(event.target.value)}
            placeholder={messages.authorPlaceholder}
            required
            type="text"
            value={authorName}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{messages.contentLabel}</span>
          <textarea
            className={styles.textarea}
            maxLength={COMMENT_CONTENT_MAX_LENGTH}
            name="content"
            onChange={event => setContent(event.target.value)}
            placeholder={messages.contentPlaceholder}
            required
            rows={4}
            value={content}
          />
        </label>
        <div className={styles.formFooter}>
          <span className={styles.characterCount}>
            {content.length}/{COMMENT_CONTENT_MAX_LENGTH}
          </span>
          <button className={styles.submitButton} disabled={isSubmitting} type="submit">
            {isSubmitting ? messages.submitting : messages.submit}
          </button>
        </div>
        {submitError == null ? null : (
          <p className={styles.errorMessage} role="alert">
            {submitError}
          </p>
        )}
      </form>

      <div className={styles.listArea}>
        {isLoading ? (
          <p className={styles.statusMessage} role="status">
            {messages.loading}
          </p>
        ) : null}
        {!isLoading && loadError != null ? (
          <div className={styles.errorState} role="alert">
            <p className={styles.errorMessage}>{loadError}</p>
            <button className={styles.retryButton} onClick={handleRetry} type="button">
              {messages.retry}
            </button>
          </div>
        ) : null}
        {!isLoading && loadError == null && comments.length === 0 ? (
          <p className={styles.statusMessage}>{messages.empty}</p>
        ) : null}
        {!isLoading && loadError == null && comments.length > 0 ? (
          <ol className={styles.commentList}>
            {comments.map(comment => (
              <li className={styles.commentItem} key={comment.id}>
                <div className={styles.commentMeta}>
                  <strong className={styles.authorName}>{comment.authorName}</strong>
                  <time className={styles.commentDate} dateTime={comment.createdAt}>
                    {COMMENT_DATE_FORMATTERS[locale].format(new Date(comment.createdAt))}
                  </time>
                </div>
                <p className={styles.commentContent}>{comment.content}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function createCommentsApiPath(postSlug: string): string {
  return `/api/posts/${encodeURIComponent(postSlug)}/comments`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
