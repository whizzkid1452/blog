'use client';

import * as Toast from '@radix-ui/react-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import styles from './markdown-code-block.module.css';

type CopyResult = 'success' | 'failure';

interface MarkdownCodeBlockFeedback {
  showCopyResult: (result: CopyResult) => void;
}

interface MarkdownCodeBlockProviderProps {
  children: ReactNode;
}

const COPY_FEEDBACK = {
  success: { title: 'Copied', description: 'Code copied to clipboard.' },
  failure: { title: 'Copy failed', description: 'Copy the code manually from the block.' },
} satisfies Record<CopyResult, { title: string; description: string }>;

const MarkdownCodeBlockFeedbackContext = createContext<MarkdownCodeBlockFeedback | null>(null);

export function MarkdownCodeBlockProvider({ children }: MarkdownCodeBlockProviderProps) {
  const [toastState, setToastState] = useState({ open: false, title: '', description: '' });
  const showCopyResult = useCallback((result: CopyResult) => {
    setToastState({ open: true, ...COPY_FEEDBACK[result] });
  }, []);
  const contextValue = useMemo(() => ({ showCopyResult }), [showCopyResult]);

  return (
    <MarkdownCodeBlockFeedbackContext.Provider value={contextValue}>
      <Tooltip.Provider delayDuration={250}>
        <Toast.Provider swipeDirection="right">
          {children}
          <Toast.Root
            className={styles.toastRoot}
            open={toastState.open}
            aria-live="polite"
            onOpenChange={open => setToastState(current => ({ ...current, open }))}
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

export function useMarkdownCodeBlockFeedback(): MarkdownCodeBlockFeedback {
  return useContext(MarkdownCodeBlockFeedbackContext) ?? { showCopyResult: () => undefined };
}
