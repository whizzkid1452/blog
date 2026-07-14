import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseEnvironment } from './environment';

export async function updateSupabaseAuthSession(request: NextRequest): Promise<NextResponse> {
  const environment = getSupabaseEnvironment();
  let response = NextResponse.next({ request });
  const supabaseClient = createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: cookiesToSet => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabaseClient.auth.getClaims();

  return response;
}
