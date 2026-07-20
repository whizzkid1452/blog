'use client';

import type { ReactNode, RefObject } from 'react';
import { MarkdownCodeBlock } from './markdown-code-block';
import { useMermaidRender, type MermaidRenderState } from './use-mermaid-render';
import styles from './markdown-mermaid-diagram.module.css';

interface MarkdownMermaidDiagramProps {
  chart: string;
}

const EMPTY_MERMAID_RENDER_STATE = {
  kind: 'error',
  message: 'Mermaid diagram source is empty.',
} satisfies MermaidRenderState;

export function MarkdownMermaidDiagram({ chart }: MarkdownMermaidDiagramProps) {
  const chartSource = chart.trim();
  const { diagramContainerRef, renderState } = useMermaidRender(chartSource);
  const displayedRenderState = chartSource.length === 0 ? EMPTY_MERMAID_RENDER_STATE : renderState;

  return (
    <MarkdownCodeBlock copyText={chartSource}>
      <div className={styles.mermaidDiagramShell}>
        {renderMermaidDiagramContent({
          chartSource,
          diagramContainerRef,
          renderState: displayedRenderState,
        })}
      </div>
    </MarkdownCodeBlock>
  );
}

function renderMermaidDiagramContent({
  chartSource,
  diagramContainerRef,
  renderState,
}: {
  chartSource: string;
  diagramContainerRef: RefObject<HTMLDivElement | null>;
  renderState: MermaidRenderState;
}): ReactNode {
  if (renderState.kind === 'success') {
    return (
      <div
        ref={diagramContainerRef}
        className={styles.mermaidDiagram}
        role="img"
        aria-label="Rendered Mermaid diagram"
        dangerouslySetInnerHTML={{ __html: renderState.svg }}
      />
    );
  }

  if (renderState.kind === 'error') {
    return (
      <div className={styles.mermaidError} role="alert">
        <p className={styles.mermaidErrorTitle}>Mermaid diagram failed to render.</p>
        <p className={styles.mermaidErrorMessage}>{renderState.message}</p>
        <pre className={styles.mermaidErrorSource}>{chartSource}</pre>
      </div>
    );
  }

  return (
    <div className={styles.mermaidLoading} role="status" aria-live="polite">
      Rendering Mermaid diagram...
    </div>
  );
}
