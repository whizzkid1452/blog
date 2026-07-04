'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import Link from 'next/link';
import { useState } from 'react';
import styles from './site-layout.module.css';

interface SidebarTopicsSectionProps {
  tags: string[];
}

const COLLAPSED_TOPIC_TAG_COUNT = 10;

export function SidebarTopicsSection({ tags }: SidebarTopicsSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const collapsedTags = tags.slice(0, COLLAPSED_TOPIC_TAG_COUNT);

  return (
    <Collapsible.Root asChild open={isOpen} onOpenChange={setIsOpen}>
      <section className={styles.sidebarSection}>
        <div className={styles.sidebarSectionHeader}>
          <h2 className={styles.sidebarTitle}>Topics</h2>
          <Collapsible.Trigger className={styles.sidebarSectionTrigger} type="button" aria-label="Toggle topics" />
        </div>

        {!isOpen && tags.length > 0 ? <TopicTagList tags={collapsedTags} /> : null}

        <Collapsible.Content className={styles.sidebarCollapsibleContent}>
          {tags.length > 0 ? <TopicTagList tags={tags} /> : <p className={styles.emptyText}>No topics yet.</p>}
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
          #{tag}
        </Link>
      ))}
    </div>
  );
}
