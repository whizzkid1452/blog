import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnvironment } from './environment';

interface CreateSupabaseServerClientOptions {
  canWriteCookies?: boolean;
}

export async function createSupabaseServerClient({ canWriteCookies = false }: CreateSupabaseServerClientOptions = {}) {
  const cookieStore = await cookies();
  const environment = getSupabaseEnvironment();

  return createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: cookiesToSet => {
        if (!canWriteCookies) {
          // Server Component의 세션 갱신 쿠키는 proxy가 응답에 기록한다.
          return;
        }

        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}
