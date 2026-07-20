'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';
import { useEffect, useState, type MouseEvent } from 'react';
import styles from './markdown-content.module.css';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';

interface MarkdownTableOfContentsNavigationProps {
  items: MarkdownTableOfContentsItem[];
  locale: Locale;
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

interface ScrollToTableOfContentsHeadingParams {
  prefersReducedMotion: boolean;
  scrollIntoView: (options: ScrollIntoViewOptions) => void;
}

const HEADING_ACTIVATION_OFFSET = 96;
const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export function MarkdownTableOfContentsNavigation({ items, locale }: MarkdownTableOfContentsNavigationProps) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(items[0]?.id ?? null);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const messages = getUiMessages(locale);

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
    scrollToTableOfContentsHeading({
      prefersReducedMotion: window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches,
      scrollIntoView: options => heading.scrollIntoView(options),
    });
    window.history.pushState(null, '', `#${encodeURIComponent(headingId)}`);
    setActiveHeadingId(headingId);
  };

  return (
    <>
      <section className={styles.tableOfContentsTop}>
        <nav aria-labelledby="markdown-table-of-contents-top-title">
          <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-top-title">
            {messages.tableOfContentsLabel}
          </p>
          <TableOfContentsList activeHeadingId={activeHeadingId} items={items} onClick={handleTableOfContentsClick} />
        </nav>
      </section>

      <aside className={styles.tableOfContentsNavigation}>
        <nav aria-labelledby="markdown-table-of-contents-title">
          <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-title">
            {messages.tableOfContentsLabel}
          </p>
          <TableOfContentsList activeHeadingId={activeHeadingId} items={items} onClick={handleTableOfContentsClick} />
        </nav>
      </aside>

      <Dialog.Root open={isMobileNavigationOpen} onOpenChange={setIsMobileNavigationOpen}>
        <Dialog.Trigger
          className={styles.mobileTableOfContentsTrigger}
          data-liquid-glass="control"
          data-motion="pressable"
          type="button"
          aria-label={messages.openTableOfContentsLabel}
        >
          <svg className={styles.mobileTableOfContentsTriggerIcon} viewBox="0 0 20 20" aria-hidden="true">
            <path d="m2 4.5 1.5 1.5L6 3M8.5 5h9M2 9.5 3.5 11 6 8M8.5 10h9M2 14.5l1.5 1.5L6 13M8.5 15h9" />
          </svg>
          <span className={styles.mobileTableOfContentsTriggerLabel}>{messages.tableOfContentsLabel}</span>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.mobileTableOfContentsOverlay} data-motion-overlay="backdrop" />
          <Dialog.Content className={styles.mobileTableOfContentsContent} data-motion-overlay="right-drawer">
            <header className={styles.mobileTableOfContentsHeader}>
              <Dialog.Title className={styles.mobileTableOfContentsTitle}>{messages.tableOfContentsLabel}</Dialog.Title>
              <Dialog.Description className={styles.visuallyHidden}>
                {messages.tableOfContentsDescription}
              </Dialog.Description>
              <Dialog.Close
                className={styles.mobileTableOfContentsCloseButton}
                data-motion="pressable"
                type="button"
                aria-label={messages.closeTableOfContentsLabel}
              >
                {messages.closeLabel}
              </Dialog.Close>
            </header>
            <nav aria-label={messages.tableOfContentsLabel}>
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

export function scrollToTableOfContentsHeading({
  prefersReducedMotion,
  scrollIntoView,
}: ScrollToTableOfContentsHeadingParams) {
  scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
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
