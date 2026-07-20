'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';
import { findActiveHeadingId } from './markdown-table-of-contents-scroll';

const HEADING_ACTIVATION_OFFSET = 96;
const PROGRAMMATIC_SCROLL_END_DELAY_MS = 160;
const PROGRAMMATIC_SCROLL_FALLBACK_DELAY_MS = 1000;

export function useActiveMarkdownHeading(items: MarkdownTableOfContentsItem[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(items[0]?.id ?? null);
  const programmaticScrollEndTimerRef = useRef<number | null>(null);
  const retainedHeadingIdRef = useRef<string | null>(null);

  const selectHeadingDuringProgrammaticScroll = useCallback((headingId: string) => {
    retainedHeadingIdRef.current = headingId;
    setActiveHeadingId(headingId);

    if (programmaticScrollEndTimerRef.current != null) {
      window.clearTimeout(programmaticScrollEndTimerRef.current);
    }

    programmaticScrollEndTimerRef.current = window.setTimeout(() => {
      retainedHeadingIdRef.current = null;
      programmaticScrollEndTimerRef.current = null;
    }, PROGRAMMATIC_SCROLL_FALLBACK_DELAY_MS);
  }, []);

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
          retainedHeadingId: retainedHeadingIdRef.current,
        })
      );
    };

    const scheduleActiveHeadingUpdate = () => {
      if (animationFrameId != null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateActiveHeading);
    };

    const finishProgrammaticScroll = () => {
      retainedHeadingIdRef.current = null;
      programmaticScrollEndTimerRef.current = null;
      scheduleActiveHeadingUpdate();
    };

    const scheduleProgrammaticScrollEnd = () => {
      if (retainedHeadingIdRef.current == null) {
        return;
      }

      if (programmaticScrollEndTimerRef.current != null) {
        window.clearTimeout(programmaticScrollEndTimerRef.current);
      }

      programmaticScrollEndTimerRef.current = window.setTimeout(
        finishProgrammaticScroll,
        PROGRAMMATIC_SCROLL_END_DELAY_MS
      );
    };

    const handleWindowScroll = () => {
      scheduleActiveHeadingUpdate();
      scheduleProgrammaticScrollEnd();
    };

    updateActiveHeading();
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', scheduleActiveHeadingUpdate);

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', scheduleActiveHeadingUpdate);

      if (animationFrameId != null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (programmaticScrollEndTimerRef.current != null) {
        window.clearTimeout(programmaticScrollEndTimerRef.current);
      }
    };
  }, [items]);

  return { activeHeadingId, selectHeadingDuringProgrammaticScroll };
}
