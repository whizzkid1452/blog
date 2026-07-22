import type { Locale } from '@/shared/i18n/i18n';

export interface CommentMessages {
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

export const COMMENT_MESSAGES: Record<Locale, CommentMessages> = {
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
};

export const COMMENT_DATE_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ko: new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }),
};
