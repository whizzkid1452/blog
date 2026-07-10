import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const amplifyBuildSpecificationPath = path.join(process.cwd(), 'amplify.yml');

describe('Amplify build specification', () => {
  it('builds the application with pnpm', () => {
    const buildSpecification = fs.readFileSync(amplifyBuildSpecificationPath, 'utf8');

    expect(buildSpecification).toContain('- pnpm build');
  });

  it('publishes the static export directory', () => {
    const buildSpecification = fs.readFileSync(amplifyBuildSpecificationPath, 'utf8');

    expect(buildSpecification).toContain('baseDirectory: out');
  });

  it('uses the Amplify branch domain when no custom site URL is configured', () => {
    const buildSpecification = fs.readFileSync(amplifyBuildSpecificationPath, 'utf8');

    expect(buildSpecification).toContain(
      'NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://${AWS_BRANCH}.${AWS_APP_ID}.amplifyapp.com}"'
    );
  });
});
