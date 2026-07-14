import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dockerfilePath = path.join(process.cwd(), 'Dockerfile');

describe('Dockerfile', () => {
  it('runs the standalone server as a non-root user', () => {
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('/app/.next/standalone');
    expect(dockerfile).toContain('USER nextjs');
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });
});
