import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath } from '@/shared/i18n/i18n';
import styles from './sidebar-search-form.module.css';
import accessibilityStyles from './visually-hidden.module.css';

interface SidebarSearchFormProps {
  locale: Locale;
}

export function SidebarSearchForm({ locale }: SidebarSearchFormProps) {
  const messages = SEARCH_FORM_MESSAGES[locale];

  return (
    <form className={styles.sidebarSearchForm} role="search" action={createLocalizedPath(locale, '/search')}>
      <label className={styles.sidebarSearchLabel}>
        <span className={accessibilityStyles.visuallyHidden}>{messages.label}</span>
        <input
          className={styles.sidebarSearchInput}
          type="search"
          name="q"
          placeholder={messages.placeholder}
          autoComplete="off"
        />
      </label>
      <button className={styles.sidebarSearchButton} type="submit" aria-label={messages.submit}>
        <svg className={styles.sidebarSearchIcon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
      </button>
    </form>
  );
}

const SEARCH_FORM_MESSAGES = {
  ko: {
    label: '검색어',
    placeholder: '글 검색',
    submit: '검색',
  },
} satisfies Record<Locale, SearchFormMessages>;

interface SearchFormMessages {
  label: string;
  placeholder: string;
  submit: string;
}
