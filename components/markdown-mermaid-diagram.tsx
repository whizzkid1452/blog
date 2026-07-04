'use client';

import type { MermaidConfig, RenderResult } from 'mermaid';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MarkdownCodeBlock } from './markdown-code-block';
import styles from './markdown-content.module.css';

interface MarkdownMermaidDiagramProps {
  chart: string;
}

interface MermaidThemeVariables {
  background: string;
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  textColor: string;
  mainBkg: string;
  nodeBorder: string;
  clusterBkg: string;
  clusterBorder: string;
  edgeLabelBackground: string;
}

type ColorScheme = 'light' | 'dark';

type MermaidRenderState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'success';
      svg: string;
    }
  | {
      kind: 'error';
      message: string;
    };

const MERMAID_THEME_VARIABLES: Record<ColorScheme, MermaidThemeVariables> = {
  light: {
    background: '#ffffff',
    primaryColor: '#f8fafc',
    primaryTextColor: '#18181b',
    primaryBorderColor: '#cbd5e1',
    lineColor: '#52525b',
    secondaryColor: '#eff6ff',
    tertiaryColor: '#f4f4f5',
    textColor: '#18181b',
    mainBkg: '#ffffff',
    nodeBorder: '#cbd5e1',
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    edgeLabelBackground: '#ffffff',
  },
  dark: {
    background: '#111111',
    primaryColor: '#18181b',
    primaryTextColor: '#f4f4f5',
    primaryBorderColor: '#52525b',
    lineColor: '#a1a1aa',
    secondaryColor: '#172554',
    tertiaryColor: '#27272a',
    textColor: '#f4f4f5',
    mainBkg: '#18181b',
    nodeBorder: '#52525b',
    clusterBkg: '#18181b',
    clusterBorder: '#52525b',
    edgeLabelBackground: '#111111',
  },
};

const MERMAID_RENDER_ID_PREFIX = 'markdown-mermaid';
const MERMAID_RENDER_ID_INVALID_CHARACTER_PATTERN = /[^a-zA-Z0-9_-]/g;
const EMPTY_MERMAID_RENDER_STATE = {
  kind: 'error',
  message: 'Mermaid diagram source is empty.',
} satisfies MermaidRenderState;

export function MarkdownMermaidDiagram({ chart }: MarkdownMermaidDiagramProps) {
  const chartSource = chart.trim();
  const colorScheme = usePreferredColorScheme();
  const diagramIdBase = useMermaidDiagramIdBase();
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const bindFunctionsRef = useRef<RenderResult['bindFunctions'] | null>(null);
  const renderCountRef = useRef(0);
  const [renderState, setRenderState] = useState<MermaidRenderState>({ kind: 'loading' });

  useEffect(() => {
    if (chartSource.length === 0) {
      return;
    }

    let isCurrentRender = true;
    const renderId = `${diagramIdBase}-${renderCountRef.current}`;
    renderCountRef.current += 1;
    bindFunctionsRef.current = null;

    async function renderMermaidDiagram() {
      try {
        const { default: mermaid } = await import('mermaid');

        mermaid.initialize(createMermaidConfig(colorScheme));

        const renderResult = await mermaid.render(renderId, chartSource);

        if (!isCurrentRender) {
          return;
        }

        bindFunctionsRef.current = renderResult.bindFunctions ?? null;
        setRenderState({
          kind: 'success',
          svg: renderResult.svg,
        });
      } catch (error) {
        if (!isCurrentRender) {
          return;
        }

        bindFunctionsRef.current = null;
        setRenderState({
          kind: 'error',
          message: getErrorMessage(error),
        });
      }
    }

    void renderMermaidDiagram();

    return () => {
      isCurrentRender = false;
    };
  }, [chartSource, colorScheme, diagramIdBase]);

  const displayedRenderState = chartSource.length === 0 ? EMPTY_MERMAID_RENDER_STATE : renderState;

  useEffect(() => {
    if (displayedRenderState.kind !== 'success' || diagramContainerRef.current == null) {
      return;
    }

    bindFunctionsRef.current?.(diagramContainerRef.current);
  }, [displayedRenderState]);

  return (
    <MarkdownCodeBlock copyText={chartSource}>
      <div className={styles.mermaidDiagramShell}>
        {getMermaidDiagramContent(displayedRenderState, chartSource, diagramContainerRef)}
      </div>
    </MarkdownCodeBlock>
  );
}

function useMermaidDiagramIdBase(): string {
  const reactId = useId();

  return useMemo(() => {
    const sanitizedReactId = reactId.replace(MERMAID_RENDER_ID_INVALID_CHARACTER_PATTERN, '');

    return `${MERMAID_RENDER_ID_PREFIX}-${sanitizedReactId}`;
  }, [reactId]);
}

function usePreferredColorScheme(): ColorScheme {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateColorScheme = () => {
      setColorScheme(mediaQuery.matches ? 'dark' : 'light');
    };

    updateColorScheme();
    mediaQuery.addEventListener('change', updateColorScheme);

    return () => {
      mediaQuery.removeEventListener('change', updateColorScheme);
    };
  }, []);

  return colorScheme;
}

function getMermaidDiagramContent(
  renderState: MermaidRenderState,
  chartSource: string,
  diagramContainerRef: React.RefObject<HTMLDivElement | null>
): ReactNode {
  if (renderState.kind === 'success') {
    return (
      <div
        ref={diagramContainerRef}
        className={styles.mermaidDiagram}
        dangerouslySetInnerHTML={{ __html: renderState.svg }}
      />
    );
  }

  if (renderState.kind === 'error') {
    return (
      <div className={styles.mermaidError}>
        <p className={styles.mermaidErrorTitle}>Mermaid diagram failed to render.</p>
        <p className={styles.mermaidErrorMessage}>{renderState.message}</p>
        <pre className={styles.mermaidErrorSource}>{chartSource}</pre>
      </div>
    );
  }

  return <div className={styles.mermaidLoading}>Rendering Mermaid diagram...</div>;
}

function createMermaidConfig(colorScheme: ColorScheme): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: MERMAID_THEME_VARIABLES[colorScheme],
    fontFamily: 'Arial, Helvetica, sans-serif',
    flowchart: {
      htmlLabels: true,
      useMaxWidth: true,
    },
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown Mermaid render error.';
}
