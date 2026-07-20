import type { MermaidConfig } from 'mermaid';

export type MermaidColorScheme = 'light' | 'dark';

const MERMAID_THEME_VARIABLES: Record<MermaidColorScheme, NonNullable<MermaidConfig['themeVariables']>> = {
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

export function createMermaidConfig(colorScheme: MermaidColorScheme): MermaidConfig {
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
