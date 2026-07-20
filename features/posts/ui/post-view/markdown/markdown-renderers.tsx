import type { Components } from 'react-markdown';
import { MarkdownAnchor } from './markdown-anchor';
import {
  MarkdownDetails,
  MarkdownImage,
  MarkdownPre,
  MarkdownSummary,
  MarkdownTable,
} from './markdown-block-renderers';
import { MarkdownHeading } from './markdown-heading';
import { createMarkdownHeadingIdResolver } from './markdown-table-of-contents';

interface CreateMarkdownComponentsParams {
  headingIds: string[];
}

export function createMarkdownComponents({ headingIds }: CreateMarkdownComponentsParams): Components {
  const headingIdResolver = createMarkdownHeadingIdResolver({ headingIds });

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
