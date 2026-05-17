import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { normalizeEmail } from '@/lib/utils';

type RouteContext = {
  params: { id: string };
};

type InvitePayload = {
  emails?: unknown;
  locale?: string;
  resendInvitationId?: unknown;
};

type Invitation = Database['public']['Tables']['invitations']['Row'];
type InviteError = {
  email: string;
  reason: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseLocale(value: string | null | undefined): AppLocale {
  return value === 'fr' ? 'fr' : 'en';
}

function parseEmails(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((email): email is string => typeof email === 'string')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function parseResendInvitationId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function invitationResponse({
  created,
  errors,
  pendingInviteWarning,
}: {
  created: Invitation[];
  errors: InviteError[];
  pendingInviteWarning?: {
    pendingInvitations: number;
    maxMembers: number;
  };
}) {
  const response = NextResponse.json({ created, errors });

  if (pendingInviteWarning) {
    response.headers.set(
      'Warning',
      `299 ActiveBoard "pending_invitations_exceed_max_members; pending=${pendingInviteWarning.pendingInvitations}; max_members=${pendingInviteWarning.maxMembers}"`,
    );
  }

  return response;
}

export async function POST(request: Request, { params }: RouteContext) {
  const groupId = params.id;
  const payload = (await request
    .json()
    .catch(() => null)) as InvitePayload | null;
  const locale = parseLocale(payload?.locale);
  const emails = parseEmails(payload?.emails);
  const resendInvitationId = parseResendInvitationId(
    payload?.resendInvitationId,
  );
  const perf = createPerfTracker(`dashboardGroupInviteRoute:${groupId}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'groups',
      trace_kind: 'dashboard_group_invite',
    },
  });

  const { user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      {
        created: [],
        errors: [{ email: '', reason: 'unauthorized' }],
      },
      { status: 401 },
    );
  }

  if (!groupId || (emails.length === 0 && !resendInvitationId)) {
    return NextResponse.json(
      {
        created: [],
        errors: [{ email: '', reason: 'missing_fields' }],
      },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: group }, { data: membership }] = await Promise.all([
    admin
      .schema('public')
      .from('groups')
      .select('id, name, invite_code, max_members')
      .eq('id', groupId)
      .maybeSingle(),
    admin
      .schema('public')
      .from('group_members')
      .select('is_founder')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  perf.step('authorization_context_loaded');

  if (!group || !membership?.is_founder) {
    return NextResponse.json(
      {
        created: [],
        errors: [{ email: '', reason: 'not_authorized' }],
      },
      { status: 403 },
    );
  }

  const { data: inviter } = await admin
    .schema('public')
    .from('users')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const inviterName =
    inviter?.display_name ?? inviter?.email ?? user.email ?? 'ActiveBoard';

  if (resendInvitationId) {
    const { data: invitation } = await admin
      .schema('public')
      .from('invitations')
      .select('*')
      .eq('id', resendInvitationId)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .eq('source', 'dashboard')
      .maybeSingle();

    if (!invitation) {
      return NextResponse.json(
        {
          created: [],
          errors: [{ email: '', reason: 'invite_not_found' }],
        },
        { status: 404 },
      );
    }

    if (!hasEmailEnv()) {
      return NextResponse.json(
        {
          created: [],
          errors: [
            { email: invitation.invited_email, reason: 'email_unavailable' },
          ],
        },
        { status: 503 },
      );
    }

    const emailResult = await sendGroupInviteEmail({
      locale,
      inviteId: invitation.id,
      groupId,
      groupName: group.name,
      inviteCode: group.invite_code ?? '',
      inviteeEmail: invitation.invited_email,
      inviteeExists: Boolean(invitation.invited_user_id),
      inviterUserId: user.id,
      inviterName,
    });

    if (!emailResult.ok) {
      return NextResponse.json(
        {
          created: [],
          errors: [{ email: invitation.invited_email, reason: 'email_failed' }],
        },
        { status: 502 },
      );
    }

    perf.done({ resent: 1 });

    return invitationResponse({
      created: [invitation],
      errors: [],
    });
  }

  const [
    { data: existingUsers },
    { data: existingMembers },
    { data: invites },
  ] = await Promise.all([
    admin
      .schema('public')
      .from('users')
      .select('id, email')
      .in('email', emails),
    admin
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId),
    admin
      .schema('public')
      .from('group_invites')
      .select('id, invitee_email, status')
      .eq('group_id', groupId)
      .eq('status', 'pending'),
  ]);
  perf.step('invite_guards_loaded');

  const currentUserEmail = normalizeEmail(user.email ?? '');
  const usersByEmail = new Map(
    (existingUsers ?? []).map((entry) => [normalizeEmail(entry.email), entry]),
  );
  const memberUserIds = new Set(
    (existingMembers ?? []).map((member) => member.user_id),
  );
  const pendingInviteEmails = new Set(
    (invites ?? []).map((invite) => normalizeEmail(invite.invitee_email)),
  );

  const created: Invitation[] = [];
  const errors: InviteError[] = [];

  for (const email of emails) {
    if (!EMAIL_PATTERN.test(email)) {
      errors.push({ email, reason: 'invalid_email' });
      continue;
    }

    if (email === currentUserEmail) {
      errors.push({ email, reason: 'cannot_invite_self' });
      continue;
    }

    const existingUser = usersByEmail.get(email);

    if (existingUser?.id && memberUserIds.has(existingUser.id)) {
      errors.push({ email, reason: 'already_member' });
      continue;
    }

    if (pendingInviteEmails.has(email)) {
      errors.push({ email, reason: 'invite_exists' });
      continue;
    }

    const { data: insertedInvite, error: inviteError } = await admin
      .schema('public')
      .from('group_invites')
      .insert({
        group_id: groupId,
        invited_by: user.id,
        invitee_email: email,
        invitee_user_id: existingUser?.id ?? null,
      })
      .select('id')
      .single();

    if (inviteError || !insertedInvite?.id) {
      errors.push({
        email,
        reason:
          inviteError?.code === '23505' ? 'invite_exists' : 'action_failed',
      });
      continue;
    }

    pendingInviteEmails.add(email);

    const { data: invitation, error: invitationError } = await admin
      .schema('public')
      .from('invitations')
      .upsert(
        {
          group_invite_id: insertedInvite.id,
          group_id: groupId,
          invited_by: user.id,
          invited_email: email,
          invited_user_id: existingUser?.id ?? null,
          source: 'dashboard',
          session_id: null,
          status: 'pending',
        },
        { onConflict: 'group_invite_id' },
      )
      .select('*')
      .single();

    if (invitationError || !invitation) {
      errors.push({ email, reason: 'action_failed' });
      continue;
    }

    created.push(invitation);

    await logAppEvent({
      eventName: APP_EVENTS.groupInviteSent,
      locale,
      userId: user.id,
      groupId,
      metadata: {
        invitation_id: invitation.id,
        group_invite_id: insertedInvite.id,
        invitee_email: email,
        invitee_user_id: existingUser?.id ?? null,
        source: 'dashboard',
      },
      useAdmin: true,
    });

    if (hasEmailEnv()) {
      const emailResult = await sendGroupInviteEmail({
        locale,
        inviteId: invitation.id,
        groupId,
        groupName: group.name,
        inviteCode: group.invite_code ?? '',
        inviteeEmail: email,
        inviteeExists: Boolean(existingUser?.id),
        inviterUserId: user.id,
        inviterName,
      });

      if (!emailResult.ok) {
        errors.push({ email, reason: 'email_failed' });
      }
    } else {
      errors.push({ email, reason: 'email_unavailable' });
    }
  }
  perf.step('invites_processed');

  const pendingInvitationCount = pendingInviteEmails.size;
  const pendingInviteWarning =
    pendingInvitationCount > group.max_members
      ? {
          pendingInvitations: pendingInvitationCount,
          maxMembers: group.max_members,
        }
      : undefined;

  if (pendingInviteWarning) {
    await logAppEvent({
      eventName: APP_EVENTS.groupInviteSent,
      level: 'info',
      locale,
      userId: user.id,
      groupId,
      metadata: {
        source: 'dashboard',
        warning: 'pending_invitations_exceed_max_members',
        pending_invitations: pendingInviteWarning.pendingInvitations,
        max_members: pendingInviteWarning.maxMembers,
      },
      useAdmin: true,
    });
  }

  perf.done({
    created: created.length,
    errors: errors.length,
    pendingInviteWarning: Boolean(pendingInviteWarning),
  });

  return invitationResponse({
    created,
    errors,
    pendingInviteWarning,
  });
}
