import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
import { omitMarkdownAstNodeProp, type MarkdownAstNodeProps } from './markdown-renderer-utils';

type MarkdownAnchorProps = ComponentPropsWithoutRef<'a'> & MarkdownAstNodeProps;
type HrefNavigationKind = 'externalWeb' | 'internalRoute' | 'other';

const WEB_URL_PROTOCOLS = new Set(['http:', 'https:']);
const PROTOCOL_RELATIVE_URL_PREFIX = '//';

export function MarkdownAnchor({ href, ...anchorPropsWithNode }: MarkdownAnchorProps) {
  const anchorProps = omitMarkdownAstNodeProp(anchorPropsWithNode);

  if (href == null) {
    return <a {...anchorProps} />;
  }

  const navigationKind = getHrefNavigationKind(href);

  if (navigationKind === 'externalWeb') {
    return <a {...anchorProps} href={href} rel="noopener noreferrer" target="_blank" />;
  }

  return navigationKind === 'internalRoute' ? (
    <Link {...anchorProps} href={href} />
  ) : (
    <a {...anchorProps} href={href} />
  );
}

function getHrefNavigationKind(href: string): HrefNavigationKind {
  if (href.startsWith(PROTOCOL_RELATIVE_URL_PREFIX)) {
    return 'externalWeb';
  }

  try {
    const url = new URL(href);
    return WEB_URL_PROTOCOLS.has(url.protocol) ? 'externalWeb' : 'other';
  } catch {
    return 'internalRoute';
  }
}
