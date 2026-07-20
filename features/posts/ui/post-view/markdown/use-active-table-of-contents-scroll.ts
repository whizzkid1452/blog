'use client';

import { useEffect, type RefObject } from 'react';
import { findTableOfContentsScrollTop } from './markdown-table-of-contents-scroll';

interface UseActiveTableOfContentsScrollParams {
  activeHeadingId: string | null;
  containerRefs: Array<RefObject<HTMLElement | null>>;
  refreshDependency: boolean;
}

const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export function useActiveTableOfContentsScroll({
  activeHeadingId,
  containerRefs,
  refreshDependency,
}: UseActiveTableOfContentsScrollParams) {
  useEffect(() => {
    if (activeHeadingId == null) {
      return;
    }

    const behavior = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches ? 'auto' : 'smooth';

    for (const containerRef of containerRefs) {
      scrollActiveTableOfContentsItem({ activeHeadingId, behavior, container: containerRef.current });
    }
  }, [activeHeadingId, containerRefs, refreshDependency]);
}

function scrollActiveTableOfContentsItem({
  activeHeadingId,
  behavior,
  container,
}: {
  activeHeadingId: string;
  behavior: ScrollBehavior;
  container: HTMLElement | null;
}) {
  if (container == null) {
    return;
  }

  const activeItem = Array.from(container.querySelectorAll<HTMLElement>('[data-table-of-contents-heading-id]')).find(
    item => item.dataset.tableOfContentsHeadingId === activeHeadingId
  );

  if (activeItem == null) {
    return;
  }

  const containerBounds = container.getBoundingClientRect();
  const itemBounds = activeItem.getBoundingClientRect();
  const scrollTop = findTableOfContentsScrollTop({
    containerBottom: containerBounds.bottom,
    containerTop: containerBounds.top,
    currentScrollTop: container.scrollTop,
    itemBottom: itemBounds.bottom,
    itemTop: itemBounds.top,
  });

  container.scrollTo({ behavior, top: scrollTop });
}
