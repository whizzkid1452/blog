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
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { MarkdownCodeBlock, MarkdownCodeBlockProvider } from './markdown-code-block';
import styles from './markdown-content.module.css';
import { MarkdownMermaidDiagram } from './markdown-mermaid-diagram';
import {
  createMarkdownHeadingIdResolver,
  prepareMarkdownContent,
  type MarkdownTableOfContentsItem,
} from './markdown-table-of-contents';

interface MarkdownContentProps {
  content: string;
  title?: string;
}

export async function MarkdownContent({ content, title }: MarkdownContentProps) {
  const preparedContent = prepareMarkdownContent({ content, title });
  const renderedContent = await MarkdownAsync({
    children: preparedContent.content,
    components: createMarkdownComponents({ tableOfContentsItems: preparedContent.tableOfContentsItems }),
    rehypePlugins: [rehypeRaw, [rehypePrettyCode, REHYPE_PRETTY_CODE_OPTIONS]],
    remarkPlugins: [remarkGfm],
  });

  return (
    <MarkdownCodeBlockProvider>
      <div className={styles.markdownLayout}>
        {preparedContent.tableOfContentsItems.length > 0 ? (
          <MarkdownTableOfContents items={preparedContent.tableOfContentsItems} />
        ) : null}
        <div className={styles.content}>{renderedContent}</div>
      </div>
    </MarkdownCodeBlockProvider>
  );
}

const WEB_URL_PROTOCOLS = new Set(['http:', 'https:']);
const PROTOCOL_RELATIVE_URL_PREFIX = '//';
const MARKDOWN_IMAGE_SIZES = '(max-width: 768px) 100vw, 768px';
const MERMAID_CODE_LANGUAGE = 'mermaid';

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

interface CreateMarkdownComponentsParams {
  tableOfContentsItems: MarkdownTableOfContentsItem[];
}

interface MarkdownTableOfContentsProps {
  items: MarkdownTableOfContentsItem[];
}

interface MarkdownHeadingProps extends ComponentPropsWithoutRef<'h2'> {
  headingIdResolver: ReturnType<typeof createMarkdownHeadingIdResolver>;
  level: 2 | 3;
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

function createMarkdownComponents({ tableOfContentsItems }: CreateMarkdownComponentsParams): Components {
  const headingIdResolver = createMarkdownHeadingIdResolver({ tableOfContentsItems });

  return {
    a: MarkdownAnchor,
    details: MarkdownDetails,
    h2: headingProps => <MarkdownHeading {...headingProps} headingIdResolver={headingIdResolver} level={2} />,
    h3: headingProps => <MarkdownHeading {...headingProps} headingIdResolver={headingIdResolver} level={3} />,
    img: MarkdownImage,
    pre: MarkdownPre,
    summary: MarkdownSummary,
  };
}

function MarkdownTableOfContents({ items }: MarkdownTableOfContentsProps) {
  return (
    <aside className={styles.tableOfContentsSidebar}>
      <nav aria-labelledby="markdown-table-of-contents-title">
        <p className={styles.tableOfContentsTitle} id="markdown-table-of-contents-title">
          목차
        </p>
        <ol className={styles.tableOfContentsList}>
          {items.map(item => (
            <li className={styles.tableOfContentsListItem} data-level={item.level} key={item.id}>
              <a className={styles.tableOfContentsLink} href={`#${item.id}`}>
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
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
