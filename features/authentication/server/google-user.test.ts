import { describe, expect, it } from 'vitest';
import { getGoogleUserFromClaims, isAuthorizedGoogleUser } from './google-user';

describe('getGoogleUserFromClaims', () => {
  it('returns a user for a Google identity', () => {
    expect(
      getGoogleUserFromClaims({
        sub: 'user-1',
        email: 'reader@example.com',
        app_metadata: { provider: 'google', providers: ['google'] },
      })
    ).toEqual({ id: 'user-1', email: 'reader@example.com' });
  });

  it('accepts a linked Google identity', () => {
    expect(
      getGoogleUserFromClaims({
        sub: 'user-1',
        app_metadata: { provider: 'github', providers: ['github', 'google'] },
      })
    ).toEqual({ id: 'user-1' });
  });

  it('rejects a non-Google identity', () => {
    expect(
      getGoogleUserFromClaims({
        sub: 'user-1',
        app_metadata: { provider: 'github', providers: ['github'] },
      })
    ).toBeNull();
  });

  it('rejects claims without a subject', () => {
    expect(getGoogleUserFromClaims({ app_metadata: { provider: 'google' } })).toBeNull();
  });
});

describe('isAuthorizedGoogleUser', () => {
  it('accepts the configured Google email case-insensitively', () => {
    expect(isAuthorizedGoogleUser({ id: 'user-1', email: 'Owner@Example.com' }, ' owner@example.com ')).toBe(true);
  });

  it('rejects a different Google email', () => {
    expect(isAuthorizedGoogleUser({ id: 'user-1', email: 'reader@example.com' }, 'owner@example.com')).toBe(false);
  });

  it('fails closed when the configured email or claim email is missing', () => {
    expect(isAuthorizedGoogleUser({ id: 'user-1', email: 'owner@example.com' }, undefined)).toBe(false);
    expect(isAuthorizedGoogleUser({ id: 'user-1' }, 'owner@example.com')).toBe(false);
  });
});
