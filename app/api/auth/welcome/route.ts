import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { sendAccountWelcomeEmail } from '@/lib/notifications/account';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function normalizeLocale(value: unknown): AppLocale {
  return routing.locales.includes(value as AppLocale) ? (value as AppLocale) : routing.defaultLocale;
}

export async function POST(request: Request) {
  if (!hasEmailEnv()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let payload: { email?: unknown; displayName?: unknown; locale?: unknown };

  try {
    payload = (await request.json()) as { email?: unknown; displayName?: unknown; locale?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : null;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || user.email.toLowerCase() !== email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await sendAccountWelcomeEmail({
    locale: normalizeLocale(payload.locale),
    email,
    userId: user.id,
    displayName,
  });

  return NextResponse.json({ ok: true });
}
