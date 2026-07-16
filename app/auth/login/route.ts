import { getSafeReturnPath } from '@/features/authentication/server/redirect';
import { getSiteUrl } from '@/shared/config/site-config';
import { createSupabaseServerClient } from '@/shared/infrastructure/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const returnPath = getSafeReturnPath(requestUrl.searchParams.get('next'));
  const callbackUrl = new URL('/auth/callback', getSiteUrl());
  callbackUrl.searchParams.set('next', returnPath);

  const supabaseClient = await createSupabaseServerClient();
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: 'openid email profile',
    },
  });

  if (error != null || data.url == null) {
    return new Response('Google 로그인을 시작하지 못했습니다.', { status: 503 });
  }

  return NextResponse.redirect(data.url);
}
