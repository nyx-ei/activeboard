import { NextResponse } from 'next/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type LocalePayload = {
  locale?: unknown;
};

function isAppLocale(value: unknown): value is AppLocale {
  return routing.locales.includes(value as AppLocale);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as LocalePayload;

  if (!isAppLocale(payload.locale)) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_locale' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    );
  }

  const { error } = await supabase
    .schema('public')
    .from('users')
    .update({ locale: payload.locale })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json(
      { ok: false, reason: 'update_failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, locale: payload.locale });
}
