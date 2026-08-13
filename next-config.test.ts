import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('nextConfig', () => {
  it('uses the native Vercel Next.js build output', () => {
    expect(nextConfig.output).toBeUndefined();
  });

  it('redirects the resume path to the public Notion resume', async () => {
    await expect(nextConfig.redirects?.()).resolves.toEqual([
      {
        source: '/resume',
        destination:
          'https://elderly-mosquito-87f.notion.site/Software-Engineer-38073b56612a80efb6e1f5f7055e5c15?pvs=74',
        permanent: true,
      },
    ]);
  });
});
