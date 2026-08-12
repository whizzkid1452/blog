import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSiteUrl } from './site-config';

describe('getSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the local development URL outside production when no public URL is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_URL', '');

    expect(getSiteUrl().toString()).toBe('http://localhost:3000/');
  });

  it('uses NEXT_PUBLIC_SITE_URL when it is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    expect(getSiteUrl().toString()).toBe('https://example.com/');
  });

  it('uses VERCEL_URL as an HTTPS URL when no explicit public URL is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_URL', 'blog.example.vercel.app');

    expect(getSiteUrl().toString()).toBe('https://blog.example.vercel.app/');
  });

  it('allows a local URL during a local production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');

    expect(getSiteUrl().toString()).toBe('http://localhost:3000/');
  });

  it('rejects a missing public URL in a production deployment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_URL', '');

    expect(() => getSiteUrl()).toThrow('NEXT_PUBLIC_SITE_URL or VERCEL_URL is required');
  });

  it('rejects a local public URL in a production deployment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');

    expect(() => getSiteUrl()).toThrow('NEXT_PUBLIC_SITE_URL must not point to a local host in production');
  });

  it('rejects a non-web public URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'ftp://example.com');

    expect(() => getSiteUrl()).toThrow('NEXT_PUBLIC_SITE_URL must use an HTTP or HTTPS URL');
  });
});
