'use client';

import {
  COMMENT_AUTHOR_NAME_MAX_LENGTH,
  COMMENT_CONTENT_MAX_LENGTH,
  commentCreateResponseSchema,
  commentListResponseSchema,
} from '@/lib/comments/comment-schema';
import type { BlogComment } from '@/lib/comments/comment-types';
import { useEffect, useState, type FormEvent } from 'react';
import styles from './comments-section.module.css';

const COMMENT_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface CommentsSectionProps {
  postSlug: string;
}

export function CommentsSection({ postSlug }: CommentsSectionProps) {
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
          throw new Error('댓글을 불러오지 못했습니다.');
        }

        const parsedResponse = commentListResponseSchema.safeParse(responseBody);

        if (!parsedResponse.success) {
          throw new Error('댓글을 불러오지 못했습니다.');
        }

        setComments(parsedResponse.data.comments);
        setLoadError(null);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.');
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
  }, [loadRequest, postSlug]);

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
        throw new Error('댓글을 저장하지 못했습니다.');
      }

      const parsedResponse = commentCreateResponseSchema.safeParse(responseBody);

      if (!parsedResponse.success) {
        throw new Error('댓글을 저장하지 못했습니다.');
      }

      setComments(currentComments => [...currentComments, parsedResponse.data.comment]);
      setContent('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '댓글을 저장하지 못했습니다.');
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
          댓글 <span className={styles.count}>{comments.length}</span>
        </h2>
        <p className={styles.description}>닉네임과 댓글은 공개됩니다.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>닉네임</span>
          <input
            className={styles.input}
            maxLength={COMMENT_AUTHOR_NAME_MAX_LENGTH}
            name="authorName"
            onChange={event => setAuthorName(event.target.value)}
            placeholder="닉네임"
            required
            type="text"
            value={authorName}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>댓글</span>
          <textarea
            className={styles.textarea}
            maxLength={COMMENT_CONTENT_MAX_LENGTH}
            name="content"
            onChange={event => setContent(event.target.value)}
            placeholder="의견을 남겨 주세요."
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
            {isSubmitting ? '등록 중…' : '댓글 등록'}
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
            댓글을 불러오는 중입니다…
          </p>
        ) : null}
        {!isLoading && loadError != null ? (
          <div className={styles.errorState} role="alert">
            <p className={styles.errorMessage}>{loadError}</p>
            <button className={styles.retryButton} onClick={handleRetry} type="button">
              다시 시도
            </button>
          </div>
        ) : null}
        {!isLoading && loadError == null && comments.length === 0 ? (
          <p className={styles.statusMessage}>아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.</p>
        ) : null}
        {!isLoading && loadError == null && comments.length > 0 ? (
          <ol className={styles.commentList}>
            {comments.map(comment => (
              <li className={styles.commentItem} key={comment.id}>
                <div className={styles.commentMeta}>
                  <strong className={styles.authorName}>{comment.authorName}</strong>
                  <time className={styles.commentDate} dateTime={comment.createdAt}>
                    {COMMENT_DATE_FORMATTER.format(new Date(comment.createdAt))}
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
