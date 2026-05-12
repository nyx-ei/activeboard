import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail } from '@/lib/utils';

type RouteContext = {
  params: { sessionId: string };
};

type InvitePayload = {
  email?: string;
  locale?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAppLocale(value: string | undefined): value is AppLocale {
  return value === 'fr' || value === 'en';
}

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const payload = (await request
    .json()
    .catch(() => null)) as InvitePayload | null;
  const locale: AppLocale = isAppLocale(payload?.locale)
    ? payload.locale
    : 'en';
  const inviteeEmail = normalizeEmail(payload?.email ?? '');
  const perf = createPerfTracker(`sessionInviteRoute:${sessionId}`, {
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'session_invite',
    },
  });

  if (!inviteeEmail || !EMAIL_PATTERN.test(inviteeEmail)) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_email' },
      { status: 400 },
    );
  }

  const { user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'unauthorized',
        redirectTo: `/${locale}/auth/login`,
      },
      { status: 401 },
    );
  }

  if (inviteeEmail === normalizeEmail(user.email ?? '')) {
    return NextResponse.json(
      { ok: false, reason: 'cannot_invite_self' },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select('id, group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();
  perf.step('session_loaded');

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: 'session_not_available' },
      { status: 404 },
    );
  }

  if (session.status !== 'active') {
    return NextResponse.json(
      { ok: false, reason: 'session_not_active' },
      { status: 409 },
    );
  }

  const [{ data: inviterMembership }, { data: group }, { data: inviter }] =
    await Promise.all([
      admin
        .schema('public')
        .from('group_members')
        .select('is_founder')
        .eq('group_id', session.group_id)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .schema('public')
        .from('groups')
        .select('id, name, invite_code, max_members')
        .eq('id', session.group_id)
        .maybeSingle(),
      admin
        .schema('public')
        .from('users')
        .select('display_name, email')
        .eq('id', user.id)
        .maybeSingle(),
    ]);
  perf.step('authorization_context_loaded');

  const isSessionLeader = session.leader_id === user.id;
  const isFounder = inviterMembership?.is_founder === true;

  if (!group || !inviterMembership || (!isSessionLeader && !isFounder)) {
    return NextResponse.json(
      { ok: false, reason: 'not_authorized' },
      { status: 403 },
    );
  }

  const [
    { data: existingUser },
    { data: currentMembers },
    { data: existingInvite },
  ] = await Promise.all([
    admin
      .schema('public')
      .from('users')
      .select('id, email')
      .eq('email', inviteeEmail)
      .maybeSingle(),
    admin
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', session.group_id),
    admin
      .schema('public')
      .from('group_invites')
      .select('id')
      .eq('group_id', session.group_id)
      .eq('invitee_email', inviteeEmail)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);
  perf.step('invite_guards_loaded');

  if (
    existingUser?.id &&
    (currentMembers ?? []).some((member) => member.user_id === existingUser.id)
  ) {
    return NextResponse.json(
      { ok: false, reason: 'already_member' },
      { status: 409 },
    );
  }

  if ((currentMembers?.length ?? 0) >= group.max_members) {
    return NextResponse.json(
      { ok: false, reason: 'group_full' },
      { status: 422 },
    );
  }

  if (existingInvite) {
    return NextResponse.json(
      { ok: false, reason: 'invite_exists', inviteId: existingInvite.id },
      { status: 409 },
    );
  }

  const { data: insertedInvite, error: inviteError } = await admin
    .schema('public')
    .from('group_invites')
    .insert({
      group_id: session.group_id,
      invited_by: user.id,
      invited_during_session_id: session.id,
      invitee_email: inviteeEmail,
      invitee_user_id: existingUser?.id ?? null,
    })
    .select('id')
    .single();
  perf.step('invite_inserted');

  if (inviteError || !insertedInvite?.id) {
    return NextResponse.json(
      { ok: false, reason: 'action_failed' },
      { status: 500 },
    );
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupInviteSent,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId: session.id,
    metadata: {
      invite_id: insertedInvite.id,
      invitee_email: inviteeEmail,
      invitee_user_id: existingUser?.id ?? null,
      source: 'session_on_the_fly_invite',
    },
    useAdmin: true,
  });

  let emailDeliveryFailed = false;

  if (hasEmailEnv()) {
    const inviteEmailResult = await sendGroupInviteEmail({
      locale,
      inviteId: insertedInvite.id,
      groupId: session.group_id,
      groupName: group.name,
      inviteCode: group.invite_code ?? '',
      inviteeEmail,
      inviterUserId: user.id,
      inviterName:
        inviter?.display_name ?? inviter?.email ?? user.email ?? 'ActiveBoard',
    });

    emailDeliveryFailed = !inviteEmailResult.ok;
    perf.step('email_attempted');
  } else {
    emailDeliveryFailed = true;
  }

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/groups/${session.group_id}`);
  perf.done({
    inviteId: insertedInvite.id,
    emailDeliveryFailed,
  });

  return NextResponse.json({
    ok: true,
    inviteId: insertedInvite.id,
    emailDeliveryFailed,
    invitedDuringSessionId: session.id,
  });
}
