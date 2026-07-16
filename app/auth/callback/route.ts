import { getAuthenticatedGoogleUser } from '@/features/authentication/server/google-user';
import { getSafeReturnPath } from '@/features/authentication/server/redirect';
import { getSiteUrl } from '@/shared/config/site-config';
import { createSupabaseServerClient } from '@/shared/infrastructure/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code == null) {
    return new Response('OAuth 인증 코드가 없습니다.', { status: 400 });
  }

  const supabaseClient = await createSupabaseServerClient();
  const { error } = await supabaseClient.auth.exchangeCodeForSession(code);

  if (error != null) {
    return new Response('Google 로그인 세션을 만들지 못했습니다.', { status: 401 });
  }

  const user = await getAuthenticatedGoogleUser(supabaseClient);

  if (user == null) {
    await supabaseClient.auth.signOut();
    return new Response('Google 계정 인증이 필요합니다.', { status: 403 });
  }

  const returnPath = getSafeReturnPath(requestUrl.searchParams.get('next'));

  return NextResponse.redirect(new URL(returnPath, getSiteUrl()));
}
