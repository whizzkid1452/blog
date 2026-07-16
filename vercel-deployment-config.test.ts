import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const vercelConfigPath = path.join(repositoryRoot, 'vercel.json');
const removedDeploymentPaths = [
  '.dockerignore',
  'Dockerfile',
  '.github/workflows/deploy-ec2.yml',
  'docs/aws-deployment-plan.md',
  'infra/deploy-ec2.sh',
  'infra/ec2-stack.yml',
  'infra/shared-stack.yml',
  'app/api/health/route.ts',
  'app/api/health/route.test.ts',
];

function readRepositoryFile(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

describe('Vercel deployment configuration', () => {
  it('selects the Next.js framework preset', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8')) as {
      $schema?: string;
      framework?: string;
    };

    expect(vercelConfig).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      framework: 'nextjs',
    });
  });

  it('removes the AWS and container deployment artifacts', () => {
    expect(
      removedDeploymentPaths.filter(relativePath => fs.existsSync(path.join(repositoryRoot, relativePath)))
    ).toEqual([]);
  });

  it('keeps pull request verification independent of the removed ARM64 container deployment', () => {
    const pullRequestWorkflow = readRepositoryFile('.github/workflows/pr-review.yml');

    expect(pullRequestWorkflow).not.toContain('docker/setup-qemu-action');
    expect(pullRequestWorkflow).not.toContain('docker/setup-buildx-action');
    expect(pullRequestWorkflow).not.toContain('docker buildx build');
    expect(pullRequestWorkflow).not.toContain('linux/arm64');
  });

  it('documents Vercel production and preview deployments', () => {
    const readme = readRepositoryFile('README.md');

    expect(readme).toContain('Vercel');
    expect(readme).toContain('Production Branch');
    expect(readme).toContain('Preview Deployment');
    expect(readme).toContain('NEXT_PUBLIC_SITE_URL');
    expect(readme).not.toMatch(/AWS|Amazon ECR|EC2|Docker|standalone/);
  });
});
