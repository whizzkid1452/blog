import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('nextConfig', () => {
  it('exports the application as static files', () => {
    expect(nextConfig.output).toBe('export');
  });

  it('serves images without the Next.js image optimization server', () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });
});
