'use client';

import type { Locale } from '@/shared/i18n/i18n';
import { CommentForm } from './comment-form';
import { COMMENT_MESSAGES } from './comment-messages';
import { CommentList } from './comment-list';
import styles from './comments-section.module.css';
import { useComments } from './use-comments';

interface CommentsSectionProps {
  locale: Locale;
  postSlug: string;
}

export function CommentsSection({ locale, postSlug }: CommentsSectionProps) {
  const messages = COMMENT_MESSAGES[locale];
  const commentsState = useComments({ locale, postSlug });

  return (
    <section className={styles.section} aria-labelledby="comments-title">
      <header className={styles.header}>
        <h2 className={styles.title} id="comments-title">
          {messages.commentsTitle} <span className={styles.count}>{commentsState.comments.length}</span>
        </h2>
        <p className={styles.description}>{messages.privacyNotice}</p>
      </header>

      <CommentForm
        authorName={commentsState.authorName}
        content={commentsState.content}
        isSubmitting={commentsState.isSubmitting}
        messages={messages}
        onAuthorNameChange={commentsState.setAuthorName}
        onContentChange={commentsState.setContent}
        onSubmit={commentsState.submitComment}
        submitError={commentsState.submitError}
      />

      <CommentList
        comments={commentsState.comments}
        isLoading={commentsState.isLoading}
        loadError={commentsState.loadError}
        locale={locale}
        messages={messages}
        onRetry={commentsState.retry}
      />
    </section>
  );
}
