import type { ReactNode } from 'react';
import { isValidElement } from 'react';

export interface MarkdownAstNodeProps {
  node?: unknown;
}

export function omitMarkdownAstNodeProp<TProps extends MarkdownAstNodeProps>(props: TProps): Omit<TProps, 'node'> {
  const elementProps = { ...props };
  delete elementProps.node;

  return elementProps;
}

export function getMarkdownTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getMarkdownTextContent).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getMarkdownTextContent(node.props.children);
  }

  return '';
}
