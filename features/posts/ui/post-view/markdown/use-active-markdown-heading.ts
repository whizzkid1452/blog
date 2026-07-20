'use client';

import { useEffect, useState } from 'react';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';
import { findActiveHeadingId } from './markdown-table-of-contents-scroll';

const HEADING_ACTIVATION_OFFSET = 96;

export function useActiveMarkdownHeading(items: MarkdownTableOfContentsItem[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(items[0]?.id ?? null);

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

  return { activeHeadingId, setActiveHeadingId };
}
