'use client';

import { useEffect, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './study-calendar.module.css';

interface StudyCalendarTopicsProps {
  topics: string[];
  isInsideLink: boolean;
}

export function StudyCalendarTopics({ topics, isInsideLink }: StudyCalendarTopicsProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;

    if (viewport == null || list == null) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setIsOverflowing(list.scrollHeight > viewport.clientHeight);
    });

    observer.observe(viewport);
    observer.observe(list);

    return () => observer.disconnect();
  }, [topics]);

  const topicItems = topics.map(topic => (
    <li key={topic}>
      <span className={styles.topicLabel}>{topic}</span>
    </li>
  ));

  return (
    <>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div ref={viewportRef} className={styles.topicsViewport} tabIndex={isInsideLink ? undefined : 0}>
            <div
              className={styles.topicsTrack}
              data-overflow={isOverflowing || undefined}
              style={{ animationDuration: `${Math.max(6, topics.length * 1.5)}s` }}
            >
              <ul ref={listRef} className={styles.topics} aria-label="학습 주제">
                {topicItems}
              </ul>
              {isOverflowing && (
                <ul className={styles.topics} aria-hidden="true">
                  {topicItems}
                </ul>
              )}
            </div>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className={styles.topicTooltip}
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={12}
          >
            <ul className={styles.topicTooltipList}>
              {topics.map(topic => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
            <Tooltip.Arrow className={styles.topicTooltipArrow} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      {isOverflowing && (
        <span className={styles.topicsMore} aria-hidden="true">
          ...
        </span>
      )}
    </>
  );
}
