/* eslint-disable @next/next/no-img-element */
import { getPublicImageSize } from '@/lib/public-image';
import Image from 'next/image';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { isValidElement } from 'react';
import { MarkdownAsync } from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypePrettyCode from 'rehype-pretty-code';
import type { Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import remarkGfm from 'remark-gfm';
import { MarkdownCodeBlock, MarkdownCodeBlockProvider } from './markdown-code-block';
import styles from './markdown-content.module.css';

interface MarkdownContentProps {
  content: string;
  title?: string;
}

export async function MarkdownContent({ content, title }: MarkdownContentProps) {
  const renderedContent = await MarkdownAsync({
    children: removeDuplicateTitle({ content, title }),
    components: MARKDOWN_COMPONENTS,
    rehypePlugins: [[rehypePrettyCode, REHYPE_PRETTY_CODE_OPTIONS]],
    remarkPlugins: [remarkGfm],
  });

  return (
    <MarkdownCodeBlockProvider>
      <div className={styles.content}>{renderedContent}</div>
    </MarkdownCodeBlockProvider>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  a: MarkdownAnchor,
  img: MarkdownImage,
  pre: MarkdownPre,
};

const WEB_URL_PROTOCOLS = new Set(['http:', 'https:']);
const PROTOCOL_RELATIVE_URL_PREFIX = '//';
const MARKDOWN_IMAGE_SIZES = '(max-width: 768px) 100vw, 768px';

const REHYPE_PRETTY_CODE_OPTIONS = {
  theme: {
    light: 'github-light',
    dark: 'github-dark-dimmed',
  },
  keepBackground: false,
  defaultLang: {
    block: 'plaintext',
  },
} satisfies RehypePrettyCodeOptions;

type HrefNavigationKind = 'externalWeb' | 'internalRoute' | 'other';

function MarkdownAnchor({ href, ...anchorProps }: ComponentPropsWithoutRef<'a'>) {
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

function MarkdownImage({ src, alt, title }: ComponentPropsWithoutRef<'img'>) {
  if (typeof src !== 'string' || src.trim() === '') {
    return null;
  }

  const size = getPublicImageSize(src);

  if (size == null) {
    return (
      <img className={styles.markdownImage} src={src} alt={alt ?? ''} title={title} loading="lazy" decoding="async" />
    );
  }

  return (
    <Image
      className={styles.markdownImage}
      src={src}
      alt={alt ?? ''}
      title={title}
      width={size.width}
      height={size.height}
      sizes={MARKDOWN_IMAGE_SIZES}
    />
  );
}

function MarkdownPre({ children, ...preProps }: ComponentPropsWithoutRef<'pre'>) {
  return (
    <MarkdownCodeBlock copyText={getTextContent(children)}>
      <pre {...preProps}>{children}</pre>
    </MarkdownCodeBlock>
  );
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

function removeDuplicateTitle({ content, title }: MarkdownContentProps): string {
  if (title == null) {
    return content;
  }

  const trimmedTitle = title.trim();
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim();

  if (firstLine !== `# ${trimmedTitle}`) {
    return content;
  }

  return lines.slice(1).join('\n').trimStart();
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
