import { getSafeReturnPath } from '@/features/authentication/server/redirect';
import { getSiteUrl } from '@/shared/config/site-config';
import { createSupabaseServerClient } from '@/shared/infrastructure/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const returnPath = getSafeReturnPath(requestUrl.searchParams.get('next'));
  const supabaseClient = await createSupabaseServerClient();
  await supabaseClient.auth.signOut();

  return NextResponse.redirect(new URL(returnPath, getSiteUrl()), { status: 303 });
}
