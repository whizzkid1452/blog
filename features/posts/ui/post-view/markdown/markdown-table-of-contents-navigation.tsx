'use client';

import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';
import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { MarkdownTableOfContentsList } from './markdown-table-of-contents-list';
import { MobileMarkdownTableOfContents } from './mobile-markdown-table-of-contents';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';
import { scrollToTableOfContentsHeading } from './markdown-table-of-contents-scroll';
import { useActiveMarkdownHeading } from './use-active-markdown-heading';
import { useActiveTableOfContentsScroll } from './use-active-table-of-contents-scroll';
import styles from './markdown-table-of-contents-navigation.module.css';

export {
  findActiveHeadingId,
  findTableOfContentsScrollTop,
  scrollToTableOfContentsHeading,
} from './markdown-table-of-contents-scroll';

interface MarkdownTableOfContentsNavigationProps {
  items: MarkdownTableOfContentsItem[];
  locale: Locale;
}

const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export function MarkdownTableOfContentsNavigation({ items, locale }: MarkdownTableOfContentsNavigationProps) {
  const { activeHeadingId, selectHeadingDuringProgrammaticScroll } = useActiveMarkdownHeading(items);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const desktopNavigationRef = useRef<HTMLElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const navigationRefs = useMemo(() => [desktopNavigationRef, mobileNavigationRef], []);
  const messages = getUiMessages(locale);

  useActiveTableOfContentsScroll({
    activeHeadingId,
    containerRefs: navigationRefs,
    refreshDependency: isMobileNavigationOpen,
  });

  const handleTableOfContentsClick = (event: MouseEvent<HTMLAnchorElement>, headingId: string) => {
    const heading = document.getElementById(headingId);

    if (heading == null) {
      return;
    }

    event.preventDefault();
    selectHeadingDuringProgrammaticScroll(headingId);
    scrollToTableOfContentsHeading({
      prefersReducedMotion: window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches,
      scrollIntoView: options => heading.scrollIntoView(options),
    });
    window.history.pushState(null, '', `#${encodeURIComponent(headingId)}`);
  };

  return (
    <>
      <section className={styles.tableOfContentsTop}>
        <nav aria-labelledby="markdown-table-of-contents-top-title">
          <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-top-title">
            {messages.tableOfContentsLabel}
          </p>
          <MarkdownTableOfContentsList
            activeHeadingId={activeHeadingId}
            items={items}
            onClick={handleTableOfContentsClick}
          />
        </nav>
      </section>

      <aside className={styles.tableOfContentsNavigation} ref={desktopNavigationRef}>
        <nav aria-labelledby="markdown-table-of-contents-title">
          <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-title">
            {messages.tableOfContentsLabel}
          </p>
          <MarkdownTableOfContentsList
            activeHeadingId={activeHeadingId}
            items={items}
            onClick={handleTableOfContentsClick}
          />
        </nav>
      </aside>

      <MobileMarkdownTableOfContents
        activeHeadingId={activeHeadingId}
        containerRef={mobileNavigationRef}
        isOpen={isMobileNavigationOpen}
        items={items}
        messages={messages}
        onClick={(event, headingId) => {
          handleTableOfContentsClick(event, headingId);
          setIsMobileNavigationOpen(false);
        }}
        onOpenChange={setIsMobileNavigationOpen}
      />
    </>
  );
}
