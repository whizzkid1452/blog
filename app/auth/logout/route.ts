import { getSafeReturnPath } from '@/lib/auth/redirect';
import { getSiteUrl } from '@/lib/site-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const returnPath = getSafeReturnPath(requestUrl.searchParams.get('next'));
  const supabaseClient = await createSupabaseServerClient();
  await supabaseClient.auth.signOut();

  return NextResponse.redirect(new URL(returnPath, getSiteUrl()), { status: 303 });
}
