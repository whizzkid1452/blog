'use client';

import type { PostSummary } from '@/lib/posts';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import styles from './site-layout.module.css';

interface MobileNavigationDialogProps {
  primaryNavigationLinks: NavigationLink[];
  githubProfileUrl: string;
  resumeUrl: string;
  tags: string[];
  recentPosts: PostSummary[];
}

interface NavigationLink {
  href: string;
  label: string;
}

interface MobileNavigationCollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function MobileNavigationDialog({
  primaryNavigationLinks,
  githubProfileUrl,
  resumeUrl,
  tags,
  recentPosts,
}: MobileNavigationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger className={styles.mobileNavigationTrigger} type="button" aria-label="Open navigation">
        <span className={styles.mobileNavigationTriggerBar} aria-hidden="true" />
        <span className={styles.mobileNavigationTriggerBar} aria-hidden="true" />
        <span className={styles.mobileNavigationTriggerBar} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.mobileNavigationOverlay} />
        <Dialog.Content className={styles.mobileNavigationContent}>
          <header className={styles.mobileNavigationHeader}>
            <Dialog.Title className={styles.mobileNavigationTitle}>Navigation</Dialog.Title>
            <Dialog.Description className={styles.visuallyHidden}>
              Browse primary links, topics, and recent posts.
            </Dialog.Description>
            <Dialog.Close className={styles.mobileNavigationCloseButton} type="button" aria-label="Close navigation">
              Close
            </Dialog.Close>
          </header>

          <nav className={styles.mobileNavigationSection} aria-label="Mobile primary navigation">
            <h2 className={styles.mobileNavigationSectionTitle}>Primary</h2>
            <div className={styles.mobileNavigationLinkList}>
              {primaryNavigationLinks.map(link => (
                <Dialog.Close key={link.href} asChild>
                  <Link
                    className={styles.mobileNavigationLink}
                    href={link.href}
                    aria-current={isNavigationActive({ pathname, href: link.href }) ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </Dialog.Close>
              ))}
              <a
                className={styles.mobileNavigationLink}
                href={githubProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub profile"
                onClick={() => setIsOpen(false)}
              >
                GitHub
              </a>
              <a
                className={styles.mobileNavigationLink}
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="About"
                onClick={() => setIsOpen(false)}
              >
                About
              </a>
            </div>
          </nav>

          <MobileNavigationCollapsibleSection title="Topics">
            {tags.length > 0 ? (
              <div className={styles.mobileTagList}>
                {tags.map(tag => (
                  <Dialog.Close key={tag} asChild>
                    <Link className={styles.tagLink} href={`/tags/${encodeURIComponent(tag)}`}>
                      #{tag}
                    </Link>
                  </Dialog.Close>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>No topics yet.</p>
            )}
          </MobileNavigationCollapsibleSection>

          <MobileNavigationCollapsibleSection title="Recent" defaultOpen>
            {recentPosts.length > 0 ? (
              <ol className={styles.mobileRecentPostList}>
                {recentPosts.map(post => (
                  <li className={styles.recentPostItem} key={post.slug}>
                    <Dialog.Close asChild>
                      <Link className={styles.recentPostLink} href={`/posts/${post.slug}`}>
                        {post.title}
                      </Link>
                    </Dialog.Close>
                    <time className={styles.recentPostDate} dateTime={post.date}>
                      {post.date}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyText}>No posts yet.</p>
            )}
          </MobileNavigationCollapsibleSection>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MobileNavigationCollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: MobileNavigationCollapsibleSectionProps) {
  return (
    <Collapsible.Root className={styles.mobileNavigationSection} defaultOpen={defaultOpen}>
      <div className={styles.mobileNavigationSectionHeader}>
        <h2 className={styles.mobileNavigationSectionTitle}>{title}</h2>
        <Collapsible.Trigger
          className={styles.mobileNavigationSectionTrigger}
          type="button"
          aria-label={`Toggle ${title}`}
        >
          <span aria-hidden="true" />
        </Collapsible.Trigger>
      </div>
      <Collapsible.Content className={styles.mobileNavigationCollapsibleContent}>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

function isNavigationActive({ pathname, href }: { pathname: string | null; href: string }): boolean {
  if (pathname == null) {
    return false;
  }

  if (href === '/') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
