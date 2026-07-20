import * as Dialog from '@radix-ui/react-dialog';
import type { UiMessages } from '@/shared/i18n/i18n';
import type { RefObject } from 'react';
import { MarkdownTableOfContentsList, type TableOfContentsClickHandler } from './markdown-table-of-contents-list';
import type { MarkdownTableOfContentsItem } from './markdown-table-of-contents';
import styles from './markdown-table-of-contents-navigation.module.css';
import accessibilityStyles from './visually-hidden.module.css';

interface MobileMarkdownTableOfContentsProps {
  activeHeadingId: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  items: MarkdownTableOfContentsItem[];
  messages: UiMessages;
  onClick: TableOfContentsClickHandler;
  onOpenChange: (isOpen: boolean) => void;
}

export function MobileMarkdownTableOfContents({
  activeHeadingId,
  containerRef,
  isOpen,
  items,
  messages,
  onClick,
  onOpenChange,
}: MobileMarkdownTableOfContentsProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
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
        <Dialog.Content
          className={styles.mobileTableOfContentsContent}
          data-motion-overlay="right-drawer"
          ref={containerRef}
        >
          <header className={styles.mobileTableOfContentsHeader}>
            <Dialog.Title className={styles.mobileTableOfContentsTitle}>{messages.tableOfContentsLabel}</Dialog.Title>
            <Dialog.Description className={accessibilityStyles.visuallyHidden}>
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
            <MarkdownTableOfContentsList activeHeadingId={activeHeadingId} items={items} onClick={onClick} />
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
