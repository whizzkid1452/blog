import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getUiMessages } from '@/shared/i18n/i18n';
import Link from 'next/link';
import { getPrimarySidebarTopicTags, getSidebarTopicLabel } from './sidebar-topics';
import navigationStyles from './site-navigation-content.module.css';
import styles from './sidebar-topics-section.module.css';

interface SidebarTopicsSectionProps {
  locale?: Locale;
  tags: string[];
}

export function SidebarTopicsSection({ locale = 'ko', tags }: SidebarTopicsSectionProps) {
  const messages = getUiMessages(locale);
  const primaryTopicTags = getPrimarySidebarTopicTags(tags);

  return (
    <section className={navigationStyles.sidebarSection}>
      <h2 className={navigationStyles.sidebarTitle}>{messages.topics}</h2>

      {primaryTopicTags.length > 0 ? (
        <div className={styles.sidebarTopics}>
          <TopicTagList locale={locale} tags={primaryTopicTags} />
        </div>
      ) : (
        <p className={navigationStyles.emptyText}>{messages.noTopics}</p>
      )}
    </section>
  );
}

function TopicTagList({ locale, tags }: { locale: Locale; tags: string[] }) {
  return (
    <div className={styles.tagList}>
      {tags.map(tag => (
        <Link
          key={tag}
          className={styles.tagLink}
          href={createLocalizedPath(locale, `/tags/${encodeURIComponent(tag)}`)}
        >
          <span>{getSidebarTopicLabel(tag)}</span>
          <span className={styles.tagLinkChevron} aria-hidden="true">
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}
