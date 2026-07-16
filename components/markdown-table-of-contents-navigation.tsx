'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, type MouseEvent } from 'react';
import styles from './markdown-content.module.css';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';

interface MarkdownTableOfContentsNavigationProps {
  items: MarkdownTableOfContentsItem[];
}

interface HeadingPosition {
  id: string;
  top: number;
}

interface FindActiveHeadingIdParams {
  activationOffset: number;
  headingPositions: HeadingPosition[];
  isDocumentEnd?: boolean;
}

interface TableOfContentsListProps {
  activeHeadingId: string | null;
  items: MarkdownTableOfContentsItem[];
  onClick: (event: MouseEvent<HTMLAnchorElement>, headingId: string) => void;
}

const HEADING_ACTIVATION_OFFSET = 96;

export function MarkdownTableOfContentsNavigation({ items }: MarkdownTableOfContentsNavigationProps) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(items[0]?.id ?? null);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const updateActiveHeading = () => {
      animationFrameId = null;
      const headingPositions = items.flatMap(item => {
        const heading = document.getElementById(item.id);

        return heading == null ? [] : [{ id: item.id, top: heading.getBoundingClientRect().top }];
      });

      setActiveHeadingId(
        findActiveHeadingId({
          activationOffset: HEADING_ACTIVATION_OFFSET,
          headingPositions,
          isDocumentEnd: window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1,
        })
      );
    };

    const scheduleActiveHeadingUpdate = () => {
      if (animationFrameId != null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading();
    window.addEventListener('scroll', scheduleActiveHeadingUpdate, { passive: true });
    window.addEventListener('resize', scheduleActiveHeadingUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleActiveHeadingUpdate);
      window.removeEventListener('resize', scheduleActiveHeadingUpdate);

      if (animationFrameId != null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [items]);

  const handleTableOfContentsClick = (event: MouseEvent<HTMLAnchorElement>, headingId: string) => {
    const heading = document.getElementById(headingId);

    if (heading == null) {
      return;
    }

    event.preventDefault();
    heading.scrollIntoView();
    window.history.pushState(null, '', `#${encodeURIComponent(headingId)}`);
    setActiveHeadingId(headingId);
  };

  return (
    <>
      <section className={styles.tableOfContentsTop}>
        <nav aria-labelledby="markdown-table-of-contents-top-title">
          <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-top-title">
            목차
          </p>
          <TableOfContentsList activeHeadingId={activeHeadingId} items={items} onClick={handleTableOfContentsClick} />
        </nav>
      </section>

      <aside className={styles.tableOfContentsNavigation}>
        <nav aria-labelledby="markdown-table-of-contents-title">
          <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-title">
            목차
          </p>
          <TableOfContentsList activeHeadingId={activeHeadingId} items={items} onClick={handleTableOfContentsClick} />
        </nav>
      </aside>

      <Dialog.Root open={isMobileNavigationOpen} onOpenChange={setIsMobileNavigationOpen}>
        <Dialog.Trigger className={styles.mobileTableOfContentsTrigger} type="button" aria-label="목차 열기">
          <span className={styles.mobileTableOfContentsTriggerBar} aria-hidden="true" />
          <span className={styles.mobileTableOfContentsTriggerBar} aria-hidden="true" />
          <span className={styles.mobileTableOfContentsTriggerBar} aria-hidden="true" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.mobileTableOfContentsOverlay} />
          <Dialog.Content className={styles.mobileTableOfContentsContent}>
            <header className={styles.mobileTableOfContentsHeader}>
              <Dialog.Title className={styles.mobileTableOfContentsTitle}>목차</Dialog.Title>
              <Dialog.Description className={styles.visuallyHidden}>현재 글의 섹션으로 이동합니다.</Dialog.Description>
              <Dialog.Close className={styles.mobileTableOfContentsCloseButton} type="button" aria-label="목차 닫기">
                닫기
              </Dialog.Close>
            </header>
            <nav aria-label="글 목차">
              <TableOfContentsList
                activeHeadingId={activeHeadingId}
                items={items}
                onClick={(event, headingId) => {
                  handleTableOfContentsClick(event, headingId);
                  setIsMobileNavigationOpen(false);
                }}
              />
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function TableOfContentsList({ activeHeadingId, items, onClick }: TableOfContentsListProps) {
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

export function findActiveHeadingId({
  activationOffset,
  headingPositions,
  isDocumentEnd = false,
}: FindActiveHeadingIdParams): string | null {
  const firstHeading = headingPositions[0];

  if (firstHeading == null) {
    return null;
  }

  if (isDocumentEnd) {
    return headingPositions.at(-1)?.id ?? null;
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
