import { describe, expect, it } from 'vitest';
import { createMermaidConfig } from './markdown-mermaid-config';

describe('createMermaidConfig', () => {
  it('creates a strict light color-scheme configuration', () => {
    const config = createMermaidConfig('light');

    expect(config).toMatchObject({
      securityLevel: 'strict',
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        background: '#ffffff',
        primaryTextColor: '#18181b',
      },
    });
  });

  it('creates a dark color-scheme configuration', () => {
    const config = createMermaidConfig('dark');

    expect(config.themeVariables).toMatchObject({
      background: '#111111',
      primaryTextColor: '#f4f4f5',
    });
  });
});
