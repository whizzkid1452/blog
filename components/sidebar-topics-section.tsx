'use client';

import type { Locale } from '@/lib/i18n';
import { createLocalizedPath, getUiMessages } from '@/lib/i18n';
import * as Collapsible from '@radix-ui/react-collapsible';
import Link from 'next/link';
import styles from './site-layout.module.css';

interface SidebarTopicsSectionProps {
  locale?: Locale;
  tags: string[];
}

export function SidebarTopicsSection({ locale = 'ko', tags }: SidebarTopicsSectionProps) {
  const messages = getUiMessages(locale);

  return (
    <Collapsible.Root asChild defaultOpen={false}>
      <section className={styles.sidebarSection}>
        <div className={styles.sidebarSectionHeader}>
          <h2 className={styles.sidebarTitle}>{messages.topics}</h2>
          <Collapsible.Trigger
            className={styles.sidebarSectionTrigger}
            type="button"
            aria-label={`Toggle ${messages.topics}`}
          />
        </div>

        <Collapsible.Content className={styles.sidebarCollapsibleContent}>
          {tags.length > 0 ? (
            <TopicTagList locale={locale} tags={tags} />
          ) : (
            <p className={styles.emptyText}>{messages.noTopics}</p>
          )}
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
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
          #{tag}
        </Link>
      ))}
    </div>
  );
}
