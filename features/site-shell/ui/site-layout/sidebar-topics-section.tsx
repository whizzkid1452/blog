'use client';

import type { Locale } from '@/shared/i18n/i18n';
import { createLocalizedPath, getUiMessages } from '@/shared/i18n/i18n';
import * as Collapsible from '@radix-ui/react-collapsible';
import Link from 'next/link';
import { useState } from 'react';
import { getAdditionalSidebarTopicTags, getPrimarySidebarTopicTags, getSidebarTopicLabel } from './sidebar-topics';
import navigationStyles from './site-navigation-content.module.css';
import styles from './sidebar-topics-section.module.css';

interface SidebarTopicsSectionProps {
  locale?: Locale;
  tags: string[];
}

export function SidebarTopicsSection({ locale = 'ko', tags }: SidebarTopicsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const messages = getUiMessages(locale);
  const primaryTopicTags = getPrimarySidebarTopicTags(tags);
  const additionalTopicTags = getAdditionalSidebarTopicTags(tags);

  return (
    <section className={navigationStyles.sidebarSection}>
      <h2 className={navigationStyles.sidebarTitle}>{messages.topics}</h2>

      {tags.length > 0 ? (
        <div className={styles.sidebarTopics}>
          <TopicTagList locale={locale} tags={primaryTopicTags} />

          {additionalTopicTags.length > 0 ? (
            <Collapsible.Root className={styles.sidebarAdditionalTopics} open={isExpanded} onOpenChange={setIsExpanded}>
              <Collapsible.Content className={styles.sidebarCollapsibleContent}>
                <TopicTagList locale={locale} tags={additionalTopicTags} />
              </Collapsible.Content>
              <Collapsible.Trigger className={styles.sidebarSectionTrigger} type="button">
                {isExpanded ? messages.collapseTopics : messages.viewAllTopics}
              </Collapsible.Trigger>
            </Collapsible.Root>
          ) : null}
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
