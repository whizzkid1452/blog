'use client';

import type { RenderResult } from 'mermaid';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createMermaidConfig, type MermaidColorScheme } from './markdown-mermaid-config';

export type MermaidRenderState =
  { kind: 'loading' } | { kind: 'success'; svg: string } | { kind: 'error'; message: string };

const MERMAID_RENDER_ID_PREFIX = 'markdown-mermaid';
const MERMAID_RENDER_ID_INVALID_CHARACTER_PATTERN = /[^a-zA-Z0-9_-]/g;

export function useMermaidRender(chartSource: string) {
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
        setRenderState({ kind: 'success', svg: renderResult.svg });
      } catch (error) {
        if (!isCurrentRender) {
          return;
        }

        bindFunctionsRef.current = null;
        setRenderState({ kind: 'error', message: getErrorMessage(error) });
      }
    }

    void renderMermaidDiagram();

    return () => {
      isCurrentRender = false;
    };
  }, [chartSource, colorScheme, diagramIdBase]);

  useEffect(() => {
    if (renderState.kind !== 'success' || diagramContainerRef.current == null) {
      return;
    }

    bindFunctionsRef.current?.(diagramContainerRef.current);
  }, [renderState]);

  return { diagramContainerRef, renderState };
}

function useMermaidDiagramIdBase(): string {
  const reactId = useId();

  return useMemo(() => {
    const sanitizedReactId = reactId.replace(MERMAID_RENDER_ID_INVALID_CHARACTER_PATTERN, '');

    return `${MERMAID_RENDER_ID_PREFIX}-${sanitizedReactId}`;
  }, [reactId]);
}

function usePreferredColorScheme(): MermaidColorScheme {
  const [colorScheme, setColorScheme] = useState<MermaidColorScheme>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateColorScheme = () => setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    updateColorScheme();
    mediaQuery.addEventListener('change', updateColorScheme);

    return () => mediaQuery.removeEventListener('change', updateColorScheme);
  }, []);

  return colorScheme;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Mermaid render error.';
}
