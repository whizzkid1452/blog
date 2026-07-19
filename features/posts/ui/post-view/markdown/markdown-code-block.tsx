'use client';

import { writeClipboardText } from '@/shared/browser/clipboard';
import * as Toast from '@radix-ui/react-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import styles from './markdown-content.module.css';

interface MarkdownCodeBlockFeedback {
  showCopyResult: (result: CopyResult) => void;
}

interface MarkdownCodeBlockProviderProps {
  children: ReactNode;
}

interface MarkdownCodeBlockProps {
  children: ReactNode;
  copyText: string;
}

interface CopyToastState {
  open: boolean;
  title: string;
  description: string;
}

type CopyResult = 'success' | 'failure';

const COPY_SUCCESS_TOAST = {
  title: 'Copied',
  description: 'Code copied to clipboard.',
};

const COPY_FAILURE_TOAST = {
  title: 'Copy failed',
  description: 'Copy the code manually from the block.',
};

const MarkdownCodeBlockFeedbackContext = createContext<MarkdownCodeBlockFeedback | null>(null);

export function MarkdownCodeBlockProvider({ children }: MarkdownCodeBlockProviderProps) {
  const [toastState, setToastState] = useState<CopyToastState>({
    open: false,
    title: '',
    description: '',
  });

  const showCopyResult = useCallback((result: CopyResult) => {
    const toastContent = result === 'success' ? COPY_SUCCESS_TOAST : COPY_FAILURE_TOAST;

    setToastState({
      open: true,
      ...toastContent,
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      showCopyResult,
    }),
    [showCopyResult]
  );

  return (
    <MarkdownCodeBlockFeedbackContext.Provider value={contextValue}>
      <Tooltip.Provider delayDuration={250}>
        <Toast.Provider swipeDirection="right">
          {children}
          <Toast.Root
            className={styles.toastRoot}
            open={toastState.open}
            aria-live="polite"
            onOpenChange={open =>
              setToastState(currentToastState => ({
                ...currentToastState,
                open,
              }))
            }
          >
            <Toast.Title className={styles.toastTitle}>{toastState.title}</Toast.Title>
            <Toast.Description className={styles.toastDescription}>{toastState.description}</Toast.Description>
          </Toast.Root>
          <Toast.Viewport className={styles.toastViewport} aria-label="Code copy notifications" />
        </Toast.Provider>
      </Tooltip.Provider>
    </MarkdownCodeBlockFeedbackContext.Provider>
  );
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

function useMarkdownCodeBlockFeedback(): MarkdownCodeBlockFeedback {
  const context = useContext(MarkdownCodeBlockFeedbackContext);

  if (context == null) {
    return {
      showCopyResult: () => undefined,
    };
  }

  return context;
}
