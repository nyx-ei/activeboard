import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

type RouteContext = {
  params: { id: string };
};

type InvitationActionPayload = {
  action?: unknown;
  locale?: unknown;
};

type Invitation = Database['public']['Tables']['invitations']['Row'];

function parseLocale(value: unknown): AppLocale {
  return value === 'fr' ? 'fr' : 'en';
}

function parseAction(value: unknown) {
  return value === 'resend' || value === 'revoke' ? value : null;
}

async function loadInvitationContext(invitationId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: invitation } = await admin
    .schema('public')
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation) {
    return { admin, invitation: null };
  }

  const [{ data: group }, { data: membership }, { data: inviter }] =
    await Promise.all([
      admin
        .schema('public')
        .from('groups')
        .select('id, name, invite_code')
        .eq('id', invitation.group_id)
        .maybeSingle(),
      admin
        .schema('public')
        .from('group_members')
        .select('is_founder')
        .eq('group_id', invitation.group_id)
        .eq('user_id', userId)
        .maybeSingle(),
      admin
        .schema('public')
        .from('users')
        .select('display_name, email')
        .eq('id', invitation.invited_by)
        .maybeSingle(),
    ]);

  return {
    admin,
    invitation,
    group,
    membership,
    inviter,
  };
}

async function resendInvitation({
  invitation,
  locale,
  currentUserId,
}: {
  invitation: Invitation;
  locale: AppLocale;
  currentUserId: string;
}) {
  const { admin } = await loadInvitationContext(invitation.id, currentUserId);
  const [{ data: group }, { data: inviter }, { data: session }] =
    await Promise.all([
      admin
        .schema('public')
        .from('groups')
        .select('name, invite_code')
        .eq('id', invitation.group_id)
        .maybeSingle(),
      admin
        .schema('public')
        .from('users')
        .select('display_name, email')
        .eq('id', invitation.invited_by)
        .maybeSingle(),
      invitation.session_id
        ? admin
            .schema('public')
            .from('sessions')
            .select('id, name, share_code')
            .eq('id', invitation.session_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (!group || !hasEmailEnv()) {
    return { ok: false as const, reason: 'email_unavailable' };
  }

  const result = await sendGroupInviteEmail({
    locale,
    inviteId: invitation.id,
    groupId: invitation.group_id,
    groupName: group.name,
    inviteCode: group.invite_code ?? '',
    inviteeEmail: invitation.invited_email,
    inviteeExists: Boolean(invitation.invited_user_id),
    inviterUserId: invitation.invited_by,
    inviterName:
      inviter?.display_name ?? inviter?.email ?? currentUserId ?? 'ActiveBoard',
    variant:
      invitation.source === 'on_the_fly'
        ? 'mid_session_check_in'
        : 'group_invite',
    sessionId: invitation.session_id ?? undefined,
    sessionName: session?.name ?? null,
    sessionShareCode: session?.share_code ?? null,
  });

  return result.ok
    ? { ok: true as const }
    : { ok: false as const, reason: 'email_failed' };
}

export async function POST(request: Request, { params }: RouteContext) {
  const payload = (await request
    .json()
    .catch(() => null)) as InvitationActionPayload | null;
  const action = parseAction(payload?.action);
  const locale = parseLocale(payload?.locale);
  const perf = createPerfTracker(`invitationManagementRoute:${params.id}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'groups',
      trace_kind: 'invitation_management',
    },
  });

  if (!action) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_action' },
      { status: 400 },
    );
  }

  const { user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' },
      { status: 401 },
    );
  }

  const { admin, invitation, membership } = await loadInvitationContext(
    params.id,
    user.id,
  );
  perf.step('context_loaded');

  if (!invitation || invitation.status !== 'pending') {
    return NextResponse.json(
      { ok: false, reason: 'invite_not_found' },
      { status: 404 },
    );
  }

  if (!membership?.is_founder) {
    return NextResponse.json(
      { ok: false, reason: 'not_authorized' },
      { status: 403 },
    );
  }

  if (action === 'revoke') {
    const respondedAt = new Date().toISOString();
    const [invitationResult, legacyInviteResult] = await Promise.all([
      admin
        .schema('public')
        .from('invitations')
        .update({ status: 'cancelled', responded_at: respondedAt })
        .eq('id', invitation.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle(),
      admin
        .schema('public')
        .from('group_invites')
        .update({ status: 'cancelled', responded_at: respondedAt })
        .eq('id', invitation.group_invite_id)
        .eq('status', 'pending'),
    ]);

    if (invitationResult.error || legacyInviteResult.error) {
      return NextResponse.json(
        { ok: false, reason: 'action_failed' },
        { status: 500 },
      );
    }

    perf.done({ action, invitationId: invitation.id });

    return NextResponse.json({
      ok: true,
      invitation: invitationResult.data,
    });
  }

  const resendResult = await resendInvitation({
    invitation,
    locale,
    currentUserId: user.id,
  });

  if (!resendResult.ok) {
    return NextResponse.json(
      { ok: false, reason: resendResult.reason },
      { status: resendResult.reason === 'email_unavailable' ? 503 : 502 },
    );
  }

  perf.done({ action, invitationId: invitation.id });

  return NextResponse.json({ ok: true, invitation });
}
