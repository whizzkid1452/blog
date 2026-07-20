import type { MouseEvent } from 'react';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';
import styles from './markdown-table-of-contents-navigation.module.css';

export type TableOfContentsClickHandler = (event: MouseEvent<HTMLAnchorElement>, headingId: string) => void;

interface MarkdownTableOfContentsListProps {
  activeHeadingId: string | null;
  items: MarkdownTableOfContentsItem[];
  onClick: TableOfContentsClickHandler;
}

export function MarkdownTableOfContentsList({ activeHeadingId, items, onClick }: MarkdownTableOfContentsListProps) {
  return (
    <ol className={styles.tableOfContentsList}>
      {items.map(item => {
        const isActive = item.id === activeHeadingId;

        return (
          <li className={styles.tableOfContentsListItem} data-level={item.level} key={item.id}>
            <a
              aria-current={isActive ? 'location' : undefined}
              className={styles.tableOfContentsLink}
              data-active={isActive || undefined}
              data-table-of-contents-heading-id={item.id}
              href={`#${item.id}`}
              onClick={event => onClick(event, item.id)}
            >
              {item.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
