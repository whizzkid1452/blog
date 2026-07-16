import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseEnvironment } from './environment';

describe('getSupabaseEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the public Supabase configuration without environment variables', () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');

    expect(getSupabaseEnvironment()).toEqual({
      url: expect.stringMatching(/^https:\/\/[a-z0-9]+\.supabase\.co$/),
      publishableKey: expect.stringMatching(/^sb_publishable_/),
    });
  });
});
