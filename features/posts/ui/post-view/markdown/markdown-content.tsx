import { MarkdownAsync } from 'react-markdown';
import type { Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { MarkdownCodeBlockProvider } from './markdown-code-block';
import styles from './markdown-content.module.css';
import { createMarkdownComponents } from './markdown-renderers';
import { MarkdownTableOfContentsNavigation } from './markdown-table-of-contents-navigation';
import { prepareMarkdownContent } from './markdown-table-of-contents';

interface MarkdownContentProps {
  content: string;
  title?: string;
}

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
          <MarkdownTableOfContentsNavigation items={preparedContent.tableOfContentsItems} />
        ) : null}
        <div className={styles.content}>{renderedContent}</div>
      </div>
    </MarkdownCodeBlockProvider>
  );
}
