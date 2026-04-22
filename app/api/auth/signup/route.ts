import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { sendAccountWelcomeEmail } from '@/lib/notifications/account';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail } from '@/lib/utils';

type SignUpBody = {
  email?: string;
  password?: string;
  displayName?: string;
  examSession?: string;
  locale?: string;
};

type ExamSessionValue =
  | 'april_may_2026'
  | 'august_september_2026'
  | 'october_2026'
  | 'planning_ahead';

const VALID_EXAM_SESSIONS = new Set([
  'april_may_2026',
  'august_september_2026',
  'october_2026',
  'planning_ahead',
]);

function normalizeLocale(value: unknown): AppLocale {
  return value === 'fr' ? 'fr' : 'en';
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignUpBody | null;
  const email = normalizeEmail(body?.email ?? '');
  const password = body?.password ?? '';
  const displayName = body?.displayName?.trim() ?? '';
  const locale = normalizeLocale(body?.locale);
  const examSession: ExamSessionValue | null =
    typeof body?.examSession === 'string' && VALID_EXAM_SESSIONS.has(body.examSession)
      ? (body.examSession as ExamSessionValue)
      : null;

  if (!email || !displayName || password.length < 8) {
    return NextResponse.json({ ok: false, reason: 'missing_fields' }, { status: 400 });
  }

  if (!email.includes('@')) {
    return NextResponse.json({ ok: false, reason: 'invalid_email' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existingUser } = await admin
    .schema('public')
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser?.id) {
    return NextResponse.json({ ok: false, reason: 'account_exists' }, { status: 409 });
  }

  const { data: createdAuthUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      locale,
      ...(examSession ? { exam_session: examSession } : {}),
    },
  });

  if (authError || !createdAuthUser.user?.id) {
    const normalizedMessage = authError?.message?.toLowerCase() ?? '';
    if (normalizedMessage.includes('already been registered') || normalizedMessage.includes('already registered')) {
      return NextResponse.json({ ok: false, reason: 'account_exists' }, { status: 409 });
    }
    if (normalizedMessage.includes('password')) {
      return NextResponse.json({ ok: false, reason: 'weak_password' }, { status: 400 });
    }
    if (normalizedMessage.includes('email')) {
      return NextResponse.json({ ok: false, reason: 'invalid_email' }, { status: 400 });
    }
    return NextResponse.json({ ok: false, reason: 'action_failed' }, { status: 500 });
  }

  const createdUserId = createdAuthUser.user.id;

  const { error: profileError } = await admin
    .schema('public')
    .from('users')
    .upsert(
      {
        id: createdUserId,
        email,
        display_name: displayName,
        exam_session: examSession,
        locale,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    await admin.auth.admin.deleteUser(createdUserId);
    return NextResponse.json({ ok: false, reason: 'action_failed' }, { status: 500 });
  }

  if (hasEmailEnv()) {
    await sendAccountWelcomeEmail({
      locale,
      email,
      userId: createdUserId,
      displayName,
    }).catch(() => {
      // Welcome email must not block account creation.
    });
  }

  return NextResponse.json({ ok: true });
}
