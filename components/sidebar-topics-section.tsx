'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import Link from 'next/link';
import { useState } from 'react';
import styles from './site-layout.module.css';
import { getCollapsedSidebarTopicTags, getExpandedSidebarTopicTags, getSidebarTopicLabel } from './sidebar-topics';

interface SidebarTopicsSectionProps {
  tags: string[];
}

export function SidebarTopicsSection({ tags }: SidebarTopicsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const collapsedTags = getCollapsedSidebarTopicTags(tags);
  const expandedTags = getExpandedSidebarTopicTags(tags);

  return (
    <Collapsible.Root asChild open={isOpen} onOpenChange={setIsOpen}>
      <section className={styles.sidebarSection}>
        <div className={styles.sidebarSectionHeader}>
          <h2 className={styles.sidebarTitle}>Topics</h2>
          <Collapsible.Trigger className={styles.sidebarSectionTrigger} type="button" aria-label="Toggle topics" />
        </div>

        {!isOpen && collapsedTags.length > 0 ? <TopicTagList tags={collapsedTags} /> : null}

        <Collapsible.Content className={styles.sidebarCollapsibleContent}>
          {expandedTags.length > 0 ? (
            <TopicTagList tags={expandedTags} />
          ) : (
            <p className={styles.emptyText}>No topics yet.</p>
          )}
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
}

function TopicTagList({ tags }: { tags: string[] }) {
  return (
    <div className={styles.tagList}>
      {tags.map(tag => (
        <Link key={tag} className={styles.tagLink} href={`/tags/${encodeURIComponent(tag)}`}>
          #{getSidebarTopicLabel(tag)}
        </Link>
      ))}
    </div>
  );
}
