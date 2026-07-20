import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownImageViewer } from './markdown-image-viewer';

describe('MarkdownImageViewer', () => {
  it('eagerly loads an image with known dimensions for full-page export', () => {
    const markup = renderToStaticMarkup(
      <MarkdownImageViewer
        src="/images/architecture.png"
        alt="Architecture diagram"
        size={{ width: 1200, height: 630 }}
      />
    );

    expect(markup).toContain('loading="eager"');
  });

  it('eagerly loads an image without known dimensions for full-page export', () => {
    const markup = renderToStaticMarkup(
      <MarkdownImageViewer src="https://example.com/architecture.png" alt="Architecture diagram" size={null} />
    );

    expect(markup).toContain('loading="eager"');
  });
});
