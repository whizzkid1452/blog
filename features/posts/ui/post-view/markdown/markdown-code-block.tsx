'use client';

import { writeClipboardText } from '@/shared/browser/clipboard';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { useMarkdownCodeBlockFeedback } from './markdown-code-block-feedback';
import styles from './markdown-code-block.module.css';

export { MarkdownCodeBlockProvider } from './markdown-code-block-feedback';

interface MarkdownCodeBlockProps {
  children: ReactNode;
  copyText: string;
}

export function MarkdownCodeBlock({ children, copyText }: MarkdownCodeBlockProps) {
  const { showCopyResult } = useMarkdownCodeBlockFeedback();
  const isCopyingRef = useRef(false);
  const isCopyDisabled = copyText.length === 0;

  const handleCopy = useCallback(async () => {
    if (isCopyDisabled || isCopyingRef.current) {
      return;
    }

    isCopyingRef.current = true;

    try {
      await writeClipboardText(copyText);
      showCopyResult('success');
    } catch {
      showCopyResult('failure');
    } finally {
      isCopyingRef.current = false;
    }
  }, [copyText, isCopyDisabled, showCopyResult]);

  return (
    <div className={styles.codeBlock}>
      {children}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            className={styles.codeCopyButton}
            data-motion="pressable"
            type="button"
            onClick={handleCopy}
            disabled={isCopyDisabled}
            aria-label="Copy code"
          >
            Copy
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={styles.tooltipContent} side="top" sideOffset={6}>
            Copy code
            <Tooltip.Arrow className={styles.tooltipArrow} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  );
}
