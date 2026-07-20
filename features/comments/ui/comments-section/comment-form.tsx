'use client';

import { COMMENT_AUTHOR_NAME_MAX_LENGTH, COMMENT_CONTENT_MAX_LENGTH } from '../../model/comment-schema';
import type { CommentMessages } from './comment-messages';
import type { FormEvent } from 'react';
import styles from './comment-form.module.css';

interface CommentFormProps {
  authorName: string;
  content: string;
  isSubmitting: boolean;
  messages: CommentMessages;
  submitError: string | null;
  onAuthorNameChange: (authorName: string) => void;
  onContentChange: (content: string) => void;
  onSubmit: () => Promise<void>;
}

export function CommentForm({
  authorName,
  content,
  isSubmitting,
  messages,
  submitError,
  onAuthorNameChange,
  onContentChange,
  onSubmit,
}: CommentFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>{messages.authorLabel}</span>
        <input
          className={styles.input}
          maxLength={COMMENT_AUTHOR_NAME_MAX_LENGTH}
          name="authorName"
          onChange={event => onAuthorNameChange(event.target.value)}
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
          onChange={event => onContentChange(event.target.value)}
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
  );
}
