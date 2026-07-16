'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './markdown-content.module.css';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';

interface MarkdownTableOfContentsProps {
  items: MarkdownTableOfContentsItem[];
}

interface TableOfContentsHeadingPosition {
  id: string;
  top: number;
}

interface FindActiveTableOfContentsIdParams {
  activationOffset: number;
  headingPositions: TableOfContentsHeadingPosition[];
}

const ACTIVE_HEADING_OFFSET = 120;
const TABLE_OF_CONTENTS_STRUCTURAL_PREFIX_PATTERN =
  /^(?:(?:문제|조건|원인|시도|결정|설계|구현|보완|결과)\s+)?\d+(?:-\d+)*\.\s*/;

export function MarkdownTableOfContents({ items }: MarkdownTableOfContentsProps) {
  const activeItemId = useActiveTableOfContentsItem(items);
  const tableOfContentsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    keepActiveLinkVisible({ activeItemId, tableOfContentsElement: tableOfContentsRef.current });
  }, [activeItemId]);

  return (
    <aside className={styles.tableOfContentsSidebar} ref={tableOfContentsRef}>
      <nav aria-labelledby="markdown-table-of-contents-title">
        <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-title">
          목차
        </p>
        <ol className={styles.tableOfContentsList}>
          {items.map(item => (
            <li className={styles.tableOfContentsListItem} data-level={item.level} key={item.id}>
              <a
                aria-current={activeItemId === item.id ? 'location' : undefined}
                className={styles.tableOfContentsLink}
                href={`#${item.id}`}
              >
                {getTableOfContentsLabel(item.title)}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}

export function findActiveTableOfContentsId({
  activationOffset,
  headingPositions,
}: FindActiveTableOfContentsIdParams): string | null {
  const firstHeading = headingPositions[0];

  if (firstHeading == null) {
    return null;
  }

  let activeHeadingId = firstHeading.id;

  for (const headingPosition of headingPositions) {
    if (headingPosition.top > activationOffset) {
      break;
    }

    activeHeadingId = headingPosition.id;
  }

  return activeHeadingId;
}

function useActiveTableOfContentsItem(items: MarkdownTableOfContentsItem[]): string | null {
  const [activeItemId, setActiveItemId] = useState<string | null>(items[0]?.id ?? null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const updateActiveItem = () => {
      animationFrameIdRef.current = null;
      const nextActiveItemId = findActiveTableOfContentsId({
        activationOffset: ACTIVE_HEADING_OFFSET,
        headingPositions: getHeadingPositions(items),
      });

      setActiveItemId(currentActiveItemId =>
        currentActiveItemId === nextActiveItemId ? currentActiveItemId : nextActiveItemId
      );
    };
    const scheduleActiveItemUpdate = () => {
      if (animationFrameIdRef.current != null) {
        return;
      }

      animationFrameIdRef.current = window.requestAnimationFrame(updateActiveItem);
    };

    updateActiveItem();
    window.addEventListener('scroll', scheduleActiveItemUpdate, { passive: true });
    window.addEventListener('resize', scheduleActiveItemUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleActiveItemUpdate);
      window.removeEventListener('resize', scheduleActiveItemUpdate);

      if (animationFrameIdRef.current != null) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [items]);

  return activeItemId;
}

function getHeadingPositions(items: MarkdownTableOfContentsItem[]): TableOfContentsHeadingPosition[] {
  return items.flatMap(item => {
    const headingElement = document.getElementById(item.id);

    if (headingElement == null) {
      return [];
    }

    return [{ id: item.id, top: headingElement.getBoundingClientRect().top }];
  });
}

function keepActiveLinkVisible({
  activeItemId,
  tableOfContentsElement,
}: {
  activeItemId: string | null;
  tableOfContentsElement: HTMLElement | null;
}): void {
  if (activeItemId == null || tableOfContentsElement == null) {
    return;
  }

  const activeLink = tableOfContentsElement.querySelector<HTMLAnchorElement>("a[aria-current='location']");
  activeLink?.scrollIntoView({ block: 'nearest' });
}

function getTableOfContentsLabel(title: string): string {
  const label = title.replace(TABLE_OF_CONTENTS_STRUCTURAL_PREFIX_PATTERN, '').trim();

  return label === '' ? title : label;
}
