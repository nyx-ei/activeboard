import { NextResponse } from 'next/server';

import { hasEmailEnv } from '@/lib/env';
import type { AppLocale } from '@/i18n/routing';
import { sendAccountWelcomeEmail } from '@/lib/notifications/account';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail } from '@/lib/utils';

type InviteSignUpBody = {
  inviteId?: string;
  email?: string;
  password?: string;
  displayName?: string;
  locale?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as InviteSignUpBody | null;
  const inviteId = body?.inviteId?.trim() ?? '';
  const email = normalizeEmail(body?.email ?? '');
  const password = body?.password ?? '';
  const displayName = body?.displayName?.trim() ?? '';
  const locale: AppLocale = body?.locale === 'fr' ? 'fr' : 'en';

  if (!inviteId || !email || !displayName || password.length < 8) {
    return NextResponse.json({ ok: false, reason: 'missing_fields' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invite } = await admin
    .schema('public')
    .from('group_invites')
    .select('id, invitee_email, status')
    .eq('id', inviteId)
    .maybeSingle();

  if (!invite || invite.status !== 'pending') {
    return NextResponse.json({ ok: false, reason: 'invite_not_found' }, { status: 404 });
  }

  if (normalizeEmail(invite.invitee_email) !== email) {
    return NextResponse.json({ ok: false, reason: 'invite_email_mismatch' }, { status: 403 });
  }

  const { data: existingUser } = await admin.schema('public').from('users').select('id').eq('email', email).maybeSingle();

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
    },
  });

  if (authError || !createdAuthUser.user?.id) {
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
        locale,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    await admin.auth.admin.deleteUser(createdUserId);
    return NextResponse.json({ ok: false, reason: 'action_failed' }, { status: 500 });
  }

  const { error: inviteUpdateError } = await admin
    .schema('public')
    .from('group_invites')
    .update({ invitee_user_id: createdUserId })
    .eq('id', inviteId);

  if (inviteUpdateError) {
    await admin.schema('public').from('users').delete().eq('id', createdUserId);
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
      // Welcome email must not block invite signup.
    });
  }

  return NextResponse.json({ ok: true });
}
