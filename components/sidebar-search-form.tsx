import type { Locale } from '@/lib/i18n';
import { createLocalizedPath } from '@/lib/i18n';
import styles from './site-layout.module.css';

interface SidebarSearchFormProps {
  locale: Locale;
}

export function SidebarSearchForm({ locale }: SidebarSearchFormProps) {
  const messages = SEARCH_FORM_MESSAGES[locale];

  return (
    <section className={styles.sidebarSection}>
      <h2 className={styles.sidebarTitle}>{messages.title}</h2>
      <form className={styles.sidebarSearchForm} role="search" action={createLocalizedPath(locale, '/search')}>
        <label className={styles.sidebarSearchLabel}>
          <span className={styles.visuallyHidden}>{messages.label}</span>
          <input
            className={styles.sidebarSearchInput}
            type="search"
            name="q"
            placeholder={messages.placeholder}
            autoComplete="off"
          />
        </label>
        <button className={styles.sidebarSearchButton} type="submit">
          {messages.submit}
        </button>
      </form>
    </section>
  );
}

const SEARCH_FORM_MESSAGES = {
  ko: {
    title: '검색',
    label: '검색어',
    placeholder: '글 검색',
    submit: '검색',
  },
  en: {
    title: 'Search',
    label: 'Search term',
    placeholder: 'Search posts',
    submit: 'Search',
  },
} satisfies Record<Locale, SearchFormMessages>;

interface SearchFormMessages {
  title: string;
  label: string;
  placeholder: string;
  submit: string;
}
