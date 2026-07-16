import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/shared/infrastructure/supabase/server';
import { getSafeReturnPath } from './redirect';

const GOOGLE_AUTH_PROVIDER = 'google';

export interface GoogleUser {
  id: string;
  email?: string;
}

export function getGoogleUserFromClaims(claims: unknown): GoogleUser | null {
  if (!isRecord(claims) || typeof claims.sub !== 'string' || !hasGoogleProvider(claims.app_metadata)) {
    return null;
  }

  return {
    id: claims.sub,
    ...(typeof claims.email === 'string' ? { email: claims.email } : {}),
  };
}

export async function getAuthenticatedGoogleUser(supabaseClient?: SupabaseClient): Promise<GoogleUser | null> {
  const client = supabaseClient ?? (await createSupabaseServerClient());
  const { data, error } = await client.auth.getClaims();

  if (error != null) {
    return null;
  }

  return getGoogleUserFromClaims(data?.claims);
}

export async function requireAuthenticatedGoogleUser(returnPath: string): Promise<GoogleUser> {
  const user = await getAuthenticatedGoogleUser();

  if (user == null) {
    const safeReturnPath = getSafeReturnPath(returnPath);
    redirect(`/auth/login?next=${encodeURIComponent(safeReturnPath)}`);
  }

  return user;
}

function hasGoogleProvider(appMetadata: unknown): boolean {
  if (!isRecord(appMetadata)) {
    return false;
  }

  if (appMetadata.provider === GOOGLE_AUTH_PROVIDER) {
    return true;
  }

  return Array.isArray(appMetadata.providers) && appMetadata.providers.includes(GOOGLE_AUTH_PROVIDER);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
