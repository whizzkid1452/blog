import { getPublicImageSize } from '@/shared/server/public-image';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { isValidElement } from 'react';
import type { Components } from 'react-markdown';
import { MarkdownCodeBlock } from './markdown-code-block';
import styles from './markdown-content.module.css';
import { MarkdownImageViewer } from './markdown-image-viewer';
import { MarkdownMermaidDiagram } from './markdown-mermaid-diagram';
import { createMarkdownHeadingIdResolver, type MarkdownTableOfContentsItem } from './markdown-table-of-contents';

const WEB_URL_PROTOCOLS = new Set(['http:', 'https:']);
const PROTOCOL_RELATIVE_URL_PREFIX = '//';
const MERMAID_CODE_LANGUAGE = 'mermaid';

type HrefNavigationKind = 'externalWeb' | 'internalRoute' | 'other';

interface CreateMarkdownComponentsParams {
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

interface MarkdownHeadingProps extends ComponentPropsWithoutRef<'h2'> {
  headingIdResolver: ReturnType<typeof createMarkdownHeadingIdResolver>;
  level: 2 | 3 | 4;
  node?: unknown;
}

interface MarkdownAstNodeProps {
  node?: unknown;
}

type MarkdownAnchorProps = ComponentPropsWithoutRef<'a'> & MarkdownAstNodeProps;
type MarkdownDetailsProps = ComponentPropsWithoutRef<'details'> & MarkdownAstNodeProps;
type MarkdownImageProps = ComponentPropsWithoutRef<'img'> & MarkdownAstNodeProps;
type MarkdownPreProps = ComponentPropsWithoutRef<'pre'> & MarkdownAstNodeProps;
type MarkdownSummaryProps = ComponentPropsWithoutRef<'summary'> & MarkdownAstNodeProps;
type MarkdownTableProps = ComponentPropsWithoutRef<'table'> & MarkdownAstNodeProps;

export function createMarkdownComponents({ tableOfContentsItems }: CreateMarkdownComponentsParams): Components {
  const headingIdResolver = createMarkdownHeadingIdResolver({ tableOfContentsItems });

  return {
    a: MarkdownAnchor,
    details: MarkdownDetails,
    h2: headingProps => <MarkdownHeading {...headingProps} headingIdResolver={headingIdResolver} level={2} />,
    h3: headingProps => <MarkdownHeading {...headingProps} headingIdResolver={headingIdResolver} level={3} />,
    h4: headingProps => <MarkdownHeading {...headingProps} headingIdResolver={headingIdResolver} level={4} />,
    img: MarkdownImage,
    pre: MarkdownPre,
    summary: MarkdownSummary,
    table: MarkdownTable,
  };
}

function MarkdownHeading({ children, headingIdResolver, level, ...headingPropsWithNode }: MarkdownHeadingProps) {
  const HeadingTag = `h${level}` as const;
  const headingProps = omitMarkdownAstNodeProp(headingPropsWithNode);
  const headingId = headingProps.id ?? headingIdResolver.resolveId(getTextContent(children));

  return (
    <HeadingTag {...headingProps} id={headingId}>
      {children}
    </HeadingTag>
  );
}

function MarkdownAnchor({ href, ...anchorPropsWithNode }: MarkdownAnchorProps) {
  const anchorProps = omitMarkdownAstNodeProp(anchorPropsWithNode);

  if (href == null) {
    return <a {...anchorProps} />;
  }

  const navigationKind = getHrefNavigationKind(href);

  if (navigationKind === 'externalWeb') {
    return <a {...anchorProps} href={href} rel="noopener noreferrer" target="_blank" />;
  }

  if (navigationKind === 'internalRoute') {
    return <Link {...anchorProps} href={href} />;
  }

  return <a {...anchorProps} href={href} />;
}

function MarkdownDetails(detailsPropsWithNode: MarkdownDetailsProps) {
  const detailsProps = omitMarkdownAstNodeProp(detailsPropsWithNode);
  const className = [styles.tableOfContents, detailsProps.className].filter(Boolean).join(' ');

  return <details {...detailsProps} className={className} />;
}

function MarkdownSummary(summaryPropsWithNode: MarkdownSummaryProps) {
  const summaryProps = omitMarkdownAstNodeProp(summaryPropsWithNode);
  const className = [styles.tableOfContentsSummary, summaryProps.className].filter(Boolean).join(' ');

  return <summary {...summaryProps} className={className} />;
}

function MarkdownImage({ src, alt, title }: MarkdownImageProps) {
  if (typeof src !== 'string' || src.trim() === '') {
    return null;
  }

  const size = getPublicImageSize(src);

  return <MarkdownImageViewer src={src} alt={alt ?? ''} title={title} size={size} />;
}

function MarkdownTable(tablePropsWithNode: MarkdownTableProps) {
  const tableProps = omitMarkdownAstNodeProp(tablePropsWithNode);

  return (
    <div className={styles.markdownTableContainer}>
      <table {...tableProps} />
    </div>
  );
}

function MarkdownPre({ children, ...prePropsWithNode }: MarkdownPreProps) {
  const codeText = getTextContent(children);
  const preProps = omitMarkdownAstNodeProp(prePropsWithNode);

  if (getCodeBlockLanguage(preProps) === MERMAID_CODE_LANGUAGE) {
    return <MarkdownMermaidDiagram chart={codeText} />;
  }

  return (
    <MarkdownCodeBlock copyText={codeText}>
      <pre {...preProps}>{children}</pre>
    </MarkdownCodeBlock>
  );
}

function getCodeBlockLanguage(preProps: ComponentPropsWithoutRef<'pre'>): string | null {
  const language = (preProps as { 'data-language'?: unknown })['data-language'];

  if (typeof language !== 'string') {
    return null;
  }

  return language.toLowerCase();
}

function getHrefNavigationKind(href: string): HrefNavigationKind {
  if (href.startsWith(PROTOCOL_RELATIVE_URL_PREFIX)) {
    return 'externalWeb';
  }

  const absoluteUrl = parseAbsoluteUrl(href);

  if (absoluteUrl == null) {
    return 'internalRoute';
  }

  if (WEB_URL_PROTOCOLS.has(absoluteUrl.protocol)) {
    return 'externalWeb';
  }

  return 'other';
}

function parseAbsoluteUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

function omitMarkdownAstNodeProp<TProps extends MarkdownAstNodeProps>(props: TProps): Omit<TProps, 'node'> {
  const elementProps = { ...props };
  delete elementProps.node;

  return elementProps;
}

function getTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }

  return '';
}
