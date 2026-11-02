import matter from 'gray-matter';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

const RAW_MARKDOWN_MARKER_PATTERN = /\*{2,}|#{2,}/g;
const EXCLUDED_ELEMENTS = new Set(['code', 'pre', 'script', 'style']);

/**
 * @param {{ source: string }} options
 * @returns {{ marker: string, line: number, column: number }[]}
 */
export function findRawMarkdownMarkers({ source }) {
  const { content } = matter(source);
  const contentStart = source.length - content.trimStart().length;
  const sourcePrefixLines = source.slice(0, contentStart).split('\n');
  const violations = [];

  Markdown({
    children: content.trim(),
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeRaw, collectRawMarkers],
  });

  return violations;

  function collectRawMarkers() {
    return tree => visitRenderedText({ node: tree });
  }

  function visitRenderedText({ node }) {
    if (node.type === 'element' && EXCLUDED_ELEMENTS.has(node.tagName)) {
      return;
    }

    if (node.type === 'text') {
      for (const match of node.value.matchAll(RAW_MARKDOWN_MARKER_PATTERN)) {
        const precedingLines = node.value.slice(0, match.index).split('\n');
        const start = node.position.start;
        const contentLine = start.line + precedingLines.length - 1;
        const sourceColumnOffset = contentLine === 1 ? sourcePrefixLines.at(-1).length : 0;

        violations.push({
          marker: match[0],
          line: sourcePrefixLines.length - 1 + contentLine,
          column: sourceColumnOffset + (precedingLines.length === 1 ? start.column : 1) + precedingLines.at(-1).length,
        });
      }
    }

    for (const child of node.children ?? []) {
      visitRenderedText({ node: child });
    }
  }
}
