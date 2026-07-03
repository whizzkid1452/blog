'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './site-layout.module.css';

interface PrimaryNavigationLinkProps {
  href: string;
  label: string;
}

export function PrimaryNavigationLink({ href, label }: PrimaryNavigationLinkProps) {
  const pathname = usePathname();

  return (
    <Link
      className={styles.navigationAnchor}
      href={href}
      aria-current={isNavigationActive({ pathname, href }) ? 'page' : undefined}
    >
      {label}
    </Link>
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
