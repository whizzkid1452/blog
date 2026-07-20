import { getPublicImageSize } from '@/shared/server/public-image';
import type { ComponentPropsWithoutRef } from 'react';
import { MarkdownCodeBlock } from './markdown-code-block';
import { MarkdownImageViewer } from './markdown-image-viewer';
import { MarkdownMermaidDiagram } from './markdown-mermaid-diagram';
import { getMarkdownTextContent, omitMarkdownAstNodeProp, type MarkdownAstNodeProps } from './markdown-renderer-utils';
import styles from './markdown-content.module.css';

type MarkdownDetailsProps = ComponentPropsWithoutRef<'details'> & MarkdownAstNodeProps;
type MarkdownImageProps = ComponentPropsWithoutRef<'img'> & MarkdownAstNodeProps;
type MarkdownPreProps = ComponentPropsWithoutRef<'pre'> & MarkdownAstNodeProps;
type MarkdownSummaryProps = ComponentPropsWithoutRef<'summary'> & MarkdownAstNodeProps;
type MarkdownTableProps = ComponentPropsWithoutRef<'table'> & MarkdownAstNodeProps;

const MERMAID_CODE_LANGUAGE = 'mermaid';

export function MarkdownDetails(detailsPropsWithNode: MarkdownDetailsProps) {
  const detailsProps = omitMarkdownAstNodeProp(detailsPropsWithNode);
  const className = [styles.tableOfContents, detailsProps.className].filter(Boolean).join(' ');

  return <details {...detailsProps} className={className} />;
}

export function MarkdownSummary(summaryPropsWithNode: MarkdownSummaryProps) {
  const summaryProps = omitMarkdownAstNodeProp(summaryPropsWithNode);
  const className = [styles.tableOfContentsSummary, summaryProps.className].filter(Boolean).join(' ');

  return <summary {...summaryProps} className={className} />;
}

export function MarkdownImage({ src, alt, title }: MarkdownImageProps) {
  if (typeof src !== 'string' || src.trim() === '') {
    return null;
  }

  return <MarkdownImageViewer src={src} alt={alt ?? ''} title={title} size={getPublicImageSize(src)} />;
}

export function MarkdownTable(tablePropsWithNode: MarkdownTableProps) {
  const tableProps = omitMarkdownAstNodeProp(tablePropsWithNode);

  return (
    <div className={styles.markdownTableContainer}>
      <table {...tableProps} />
    </div>
  );
}

export function MarkdownPre({ children, ...prePropsWithNode }: MarkdownPreProps) {
  const codeText = getMarkdownTextContent(children);
  const preProps = omitMarkdownAstNodeProp(prePropsWithNode);
  const language = (preProps as { 'data-language'?: unknown })['data-language'];

  if (typeof language === 'string' && language.toLowerCase() === MERMAID_CODE_LANGUAGE) {
    return <MarkdownMermaidDiagram chart={codeText} />;
  }

  return (
    <MarkdownCodeBlock copyText={codeText}>
      <pre {...preProps}>{children}</pre>
    </MarkdownCodeBlock>
  );
}
