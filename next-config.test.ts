import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('nextConfig', () => {
  it('builds a standalone Node.js server artifact', () => {
    expect(nextConfig.output).toBe('standalone');
  });
});
