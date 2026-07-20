'use client';

import type { PostSummary } from '@/features/posts/model/post';
import type { Locale } from '@/shared/i18n/i18n';
import { getUiMessages } from '@/shared/i18n/i18n';
import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { SiteNavigationContent } from './site-navigation-content';
import { resolveSiteHeaderTitle } from './site-header-title';
import { useSiteHeaderVisibility } from './site-header-visibility';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import styles from './mobile-navigation-dialog.module.css';
import accessibilityStyles from './visually-hidden.module.css';

interface MobileNavigationDialogProps {
  locale: Locale;
  githubProfileUrl: string;
  resumeUrl: string;
  tags: string[];
  posts: PostSummary[];
  recentPosts: PostSummary[];
}

export function MobileNavigationDialog({
  locale,
  githubProfileUrl,
  resumeUrl,
  tags,
  posts,
  recentPosts,
}: MobileNavigationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const messages = getUiMessages(locale);
  const siteHeaderTitle = resolveSiteHeaderTitle({ locale, pathname, posts });
  const isSiteHeaderVisible = useSiteHeaderVisibility();

  const closeAfterNavigation = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a') !== null) {
      setIsOpen(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <header
        className={styles.siteHeader}
        data-liquid-glass="bar"
        data-site-header="true"
        data-site-header-visible={isSiteHeaderVisible}
        aria-hidden={!isSiteHeaderVisible}
        inert={!isSiteHeaderVisible}
      >
        <Dialog.Trigger
          className={styles.mobileNavigationTrigger}
          data-mobile-navigation-trigger="true"
          data-motion="pressable"
          type="button"
          aria-label={messages.openBlogNavigationLabel}
        >
          <span className={styles.mobileNavigationTriggerIcon} aria-hidden="true" />
        </Dialog.Trigger>
        <p className={styles.siteHeaderTitle} title={siteHeaderTitle}>
          {siteHeaderTitle}
        </p>
        <ThemeToggle locale={locale} />
      </header>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.mobileNavigationOverlay} data-motion-overlay="backdrop" />
        <Dialog.Content
          className={styles.mobileNavigationContent}
          data-motion-overlay="left-drawer"
          onClickCapture={closeAfterNavigation}
        >
          <header className={styles.mobileNavigationHeader}>
            <Dialog.Title className={accessibilityStyles.visuallyHidden}>{messages.blogNavigationLabel}</Dialog.Title>
            <Dialog.Description className={accessibilityStyles.visuallyHidden}>
              {messages.blogNavigationDescription}
            </Dialog.Description>
            <Dialog.Close
              className={styles.mobileNavigationCloseButton}
              data-motion="pressable"
              type="button"
              aria-label={messages.closeBlogNavigationLabel}
            >
              {messages.closeLabel}
            </Dialog.Close>
          </header>

          <div className={styles.mobileNavigationBody}>
            <SiteNavigationContent
              locale={locale}
              githubProfileUrl={githubProfileUrl}
              resumeUrl={resumeUrl}
              tags={tags}
              recentPosts={recentPosts}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
