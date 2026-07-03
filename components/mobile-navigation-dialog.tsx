'use client';

import type { PostSummary } from '@/lib/posts';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
            <Dialog.Close className={styles.mobileNavigationCloseButton} type="button">
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
                onClick={() => setIsOpen(false)}
              >
                GitHub
              </a>
              <a
                className={styles.mobileNavigationLink}
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
              >
                Resume
              </a>
            </div>
          </nav>

          <section className={styles.mobileNavigationSection}>
            <h2 className={styles.mobileNavigationSectionTitle}>Topics</h2>
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
          </section>

          <section className={styles.mobileNavigationSection}>
            <h2 className={styles.mobileNavigationSectionTitle}>Recent</h2>
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
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
