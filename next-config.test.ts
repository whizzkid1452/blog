import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('nextConfig', () => {
  it('uses the native Vercel Next.js build output', () => {
    expect(nextConfig.output).toBeUndefined();
  });
});
