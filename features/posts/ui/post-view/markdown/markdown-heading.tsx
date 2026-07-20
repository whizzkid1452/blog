import type { ComponentPropsWithoutRef } from 'react';
import type { createMarkdownHeadingIdResolver } from './markdown-table-of-contents';
import { getMarkdownTextContent, omitMarkdownAstNodeProp, type MarkdownAstNodeProps } from './markdown-renderer-utils';

interface MarkdownHeadingProps extends ComponentPropsWithoutRef<'h2'>, MarkdownAstNodeProps {
  headingIdResolver: ReturnType<typeof createMarkdownHeadingIdResolver>;
  level: 2 | 3 | 4;
}

export function MarkdownHeading({ children, headingIdResolver, level, ...headingPropsWithNode }: MarkdownHeadingProps) {
  const HeadingTag = `h${level}` as const;
  const headingProps = omitMarkdownAstNodeProp(headingPropsWithNode);
  const headingId = headingProps.id ?? headingIdResolver.resolveId(getMarkdownTextContent(children));

  return (
    <HeadingTag {...headingProps} id={headingId}>
      {children}
    </HeadingTag>
  );
}
