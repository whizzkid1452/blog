import type { BlogComment } from '../../model/comment-types';
import type { Locale } from '@/shared/i18n/i18n';
import { COMMENT_DATE_FORMATTERS, type CommentMessages } from './comment-messages';
import styles from './comment-list.module.css';

interface CommentListProps {
  comments: BlogComment[];
  isLoading: boolean;
  loadError: string | null;
  locale: Locale;
  messages: CommentMessages;
  onRetry: () => void;
}

export function CommentList({ comments, isLoading, loadError, locale, messages, onRetry }: CommentListProps) {
  return (
    <div className={styles.listArea}>
      {isLoading ? (
        <p className={styles.statusMessage} role="status">
          {messages.loading}
        </p>
      ) : null}
      {!isLoading && loadError != null ? (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorMessage}>{loadError}</p>
          <button className={styles.retryButton} onClick={onRetry} type="button">
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
  );
}
