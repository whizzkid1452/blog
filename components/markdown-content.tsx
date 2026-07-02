'use client';

import styled from '@emotion/styled';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  title?: string;
}

export function MarkdownContent({ content, title }: MarkdownContentProps) {
  return (
    <Content>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{removeDuplicateTitle({ content, title })}</ReactMarkdown>
    </Content>
  );
}

const Content = styled.div`
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 2;

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  h1,
  h2,
  h3 {
    color: var(--color-text-primary);
    font-weight: 650;
    line-height: 1.3;
  }

  h1 {
    margin: 0 0 24px;
    font-size: 30px;
  }

  h2 {
    margin: 36px 0 14px;
    font-size: 24px;
  }

  h3 {
    margin: 28px 0 12px;
    font-size: 20px;
  }

  p,
  ul,
  ol,
  blockquote,
  pre,
  table {
    margin: 0 0 24px;
  }

  ul,
  ol {
    padding-left: 24px;
  }

  li {
    margin: 6px 0;
    padding-left: 4px;
  }

  li > p {
    margin: 0;
  }

  strong {
    color: var(--color-text-primary);
    font-weight: 650;
  }

  a {
    color: var(--color-link);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  blockquote {
    border-left: 3px solid var(--color-border);
    padding-left: 16px;
    color: var(--color-text-primary);
  }

  pre {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 16px;
    background: color-mix(in srgb, var(--color-border) 35%, transparent);
    line-height: 1.7;
  }

  code {
    font-family: var(--font-geist-mono), Consolas, 'Courier New', monospace;
    font-size: 0.92em;
  }

  :not(pre) > code {
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2px 5px;
    background: color-mix(in srgb, var(--color-border) 25%, transparent);
    color: var(--color-text-primary);
  }

  table {
    display: block;
    width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 15px;
    line-height: 1.6;
  }

  th,
  td {
    border: 1px solid var(--color-border);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: color-mix(in srgb, var(--color-border) 30%, transparent);
    color: var(--color-text-primary);
    font-weight: 650;
  }
`;

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
