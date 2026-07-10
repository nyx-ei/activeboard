import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { routing, type AppLocale } from '@/i18n/routing';
import { getBrowserEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

type EmailOtpPayload = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  locale?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getLocale(value: unknown): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | EmailOtpPayload
    | null;
  const email = normalizeEmail(payload?.email);
  const firstName = normalizeText(payload?.firstName);
  const lastName = normalizeText(payload?.lastName);
  const fullName =
    normalizeText(payload?.fullName) || `${firstName} ${lastName}`.trim();
  const locale = getLocale(payload?.locale);

  if (!EMAIL_PATTERN.test(email) || !firstName || !lastName) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_payload' },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = new URL(`/${locale}/auth/callback`, origin);
  callbackUrl.searchParams.set('next', `/${locale}/onboarding/profile`);
  callbackUrl.searchParams.set('email', email);
  callbackUrl.searchParams.set('flow', 'trial_onboarding');

  const { supabaseUrl, supabaseAnonKey } = getBrowserEnv();
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        locale,
        onboarding_flow: 'trial_3_sessions',
      },
    },
  });

  if (error) {
    console.error('[onboarding-email-otp] failed to send verification email', {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    return NextResponse.json(
      { ok: false, reason: 'otp_failed' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
