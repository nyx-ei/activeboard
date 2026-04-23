import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type PasswordRecoveryPayload = {
  email?: string;
  locale?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PasswordRecoveryPayload | null;
  const email = payload?.email?.trim().toLowerCase() ?? '';
  const locale = payload?.locale === 'fr' ? 'fr' : 'en';

  if (!email) {
    return NextResponse.json({ ok: false, reason: 'missing_email' }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ ok: false, reason: 'invalid_email' }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const supabase = createSupabaseServerClient();

  const { data: existingUser } = await supabase.schema('public').from('users').select('id').eq('email', email).maybeSingle();

  if (!existingUser?.id) {
    return NextResponse.json({ ok: false, reason: 'account_not_found' }, { status: 404 });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/${locale}/auth/reset-password`,
  });

  if (error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes('invalid email')) {
      return NextResponse.json({ ok: false, reason: 'invalid_email' }, { status: 400 });
    }

    return NextResponse.json({ ok: false, reason: 'unexpected_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
