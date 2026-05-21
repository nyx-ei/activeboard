import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import {
  type InviteAdmissionSuccess,
  verifyInviteAdmission,
} from '@/lib/invites/admission';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendGroupFullInviteNotificationEmail } from '@/lib/notifications/group-invites';
import {
  createGroupNotifications,
  createInAppNotification,
} from '@/lib/notifications/in-app';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

type RouteContext = {
  params: { id: string };
};

type AcceptPayload = {
  locale?: string;
};

type Group = Database['public']['Tables']['groups']['Row'];
type Invitation = Database['public']['Tables']['invitations']['Row'];
type AcceptInvitation = Pick<
  Invitation,
  | 'id'
  | 'group_invite_id'
  | 'group_id'
  | 'invited_by'
  | 'invited_email'
  | 'source'
  | 'session_id'
  | 'status'
  | 'expires_at'
>;
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

function parseLocale(value: string | null | undefined): AppLocale {
  return value === 'fr' ? 'fr' : 'en';
}

function isGroupLimitError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('group member limit reached');
}

async function recordSkippedAnswersForSessionInvite({
  admin,
  userId,
  verification,
}: {
  admin: SupabaseAdminClient;
  userId: string;
  verification: InviteAdmissionSuccess;
}) {
  const sessionId = verification.sessionAdmission.sessionId;

  if (!sessionId || verification.alreadyMember) {
    return;
  }

  const { data: questions } = await admin
    .schema('public')
    .from('questions')
    .select('id, order_index, phase')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true });

  if (!questions?.length) {
    return;
  }

  const latestQuestion = questions[questions.length - 1];
  if (!latestQuestion) {
    return;
  }

  const includeCurrentQuestion =
    verification.sessionAdmission.reason === 'joining_next_question';
  const skippedQuestions = questions.filter((question) =>
    includeCurrentQuestion
      ? question.order_index <= latestQuestion.order_index
      : question.order_index < latestQuestion.order_index,
  );

  if (skippedQuestions.length === 0) {
    return;
  }

  await admin
    .schema('public')
    .from('answers')
    .upsert(
      skippedQuestions.map((question) => ({
        question_id: question.id,
        user_id: userId,
        selected_option: null,
        confidence: null,
        answer_state: 'skipped' as const,
        answered_at: new Date().toISOString(),
      })),
      { onConflict: 'question_id,user_id', ignoreDuplicates: true },
    );
}

async function notifyInviterIfGroupFull({
  admin,
  group,
  invitedBy,
  invitedEmail,
  locale,
}: {
  admin: SupabaseAdminClient;
  group: Group;
  invitedBy: string;
  invitedEmail: string;
  locale: AppLocale;
}) {
  const { data: inviter } = await admin
    .schema('public')
    .from('users')
    .select('id, email, display_name')
    .eq('id', invitedBy)
    .maybeSingle();

  if (!inviter?.email) {
    return;
  }

  await sendGroupFullInviteNotificationEmail({
    locale,
    groupId: group.id,
    groupName: group.name,
    inviterUserId: inviter.id,
    inviterEmail: inviter.email,
    inviterName: inviter.display_name ?? inviter.email,
    inviteeEmail: invitedEmail,
  });
}

async function loadInvitationByPublicOrLegacyId({
  admin,
  invitationId,
}: {
  admin: SupabaseAdminClient;
  invitationId: string;
}): Promise<{
  data: AcceptInvitation | null;
  error: { message?: string; code?: string } | null;
}> {
  const selectColumns =
    'id, group_invite_id, group_id, invited_by, invited_email, source, session_id, status, expires_at';
  const { data: invitation, error: invitationError } = await admin
    .schema('public')
    .from('invitations')
    .select(selectColumns)
    .eq('id', invitationId)
    .maybeSingle();

  if (invitation || invitationError) {
    return { data: invitation, error: invitationError };
  }

  const { data, error } = await admin
    .schema('public')
    .from('invitations')
    .select(selectColumns)
    .eq('group_invite_id', invitationId)
    .maybeSingle();

  return { data, error };
}

export async function POST(request: Request, { params }: RouteContext) {
  const invitationId = params.id;
  const body = (await request.json().catch(() => null)) as AcceptPayload | null;
  const locale = parseLocale(body?.locale);
  const perf = createPerfTracker(`acceptInvitationRoute:${invitationId}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'invites',
      trace_kind: 'accept_invitation',
    },
  });

  const { user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { accepted: false, reason: 'unauthorized' },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: invitation, error: invitationError } =
    await loadInvitationByPublicOrLegacyId({ admin, invitationId });
  perf.step('invitation_loaded');

  if (invitationError) {
    perf.done({ reason: 'action_failed' });
    return NextResponse.json(
      { accepted: false, reason: 'action_failed' },
      { status: 500 },
    );
  }

  if (!invitation) {
    perf.done({ reason: 'invitation_not_found' });
    return NextResponse.json(
      { accepted: false, reason: 'invitation_not_found' },
      { status: 404 },
    );
  }

  if (
    Number.isFinite(Date.parse(invitation.expires_at)) &&
    Date.parse(invitation.expires_at) < Date.now()
  ) {
    perf.done({ reason: 'invitation_expired' });
    return NextResponse.json(
      { accepted: false, reason: 'invitation_expired' },
      { status: 410 },
    );
  }

  const { data: group, error: groupError } = await admin
    .schema('public')
    .from('groups')
    .select('*')
    .eq('id', invitation.group_id)
    .maybeSingle();
  perf.step('group_loaded');

  if (groupError) {
    perf.done({ reason: 'action_failed' });
    return NextResponse.json(
      { accepted: false, reason: 'action_failed' },
      { status: 500 },
    );
  }

  if (!group) {
    perf.done({ reason: 'group_not_found' });
    return NextResponse.json(
      { accepted: false, reason: 'group_not_found' },
      { status: 404 },
    );
  }

  const verification = await verifyInviteAdmission({
    admin,
    inviteId: invitation.group_invite_id,
    userId: user.id,
    userEmail: user.email,
  });
  perf.step('admission_verified');

  if (!verification.ok) {
    if (verification.reason === 'group_full') {
      await notifyInviterIfGroupFull({
        admin,
        group,
        invitedBy: invitation.invited_by,
        invitedEmail: invitation.invited_email,
        locale,
      });
    }

    perf.done({ accepted: false, reason: verification.reason });
    return NextResponse.json(
      {
        accepted: false,
        group,
        reason: verification.reason,
      },
      { status: verification.status },
    );
  }

  if (!verification.alreadyMember) {
    const { error: membershipError } = await admin
      .schema('public')
      .from('group_members')
      .insert({
        group_id: verification.invite.groupId,
        is_founder: false,
        invited_during_session_id: verification.invite.invitedDuringSessionId,
        user_id: user.id,
      });

    if (membershipError && membershipError.code !== '23505') {
      if (isGroupLimitError(membershipError)) {
        await notifyInviterIfGroupFull({
          admin,
          group,
          invitedBy: invitation.invited_by,
          invitedEmail: invitation.invited_email,
          locale,
        });

        perf.done({ accepted: false, reason: 'group_full' });
        return NextResponse.json(
          {
            accepted: false,
            group,
            reason: 'group_full',
          },
          { status: 422 },
        );
      }

      perf.done({ accepted: false, reason: 'action_failed' });
      return NextResponse.json(
        {
          accepted: false,
          group,
          reason: 'action_failed',
        },
        { status: 500 },
      );
    }
  }
  perf.step('membership_persisted');

  await recordSkippedAnswersForSessionInvite({
    admin,
    userId: user.id,
    verification,
  });
  perf.step('session_skips_recorded');

  const { error: inviteUpdateError } = await admin
    .schema('public')
    .from('group_invites')
    .update({
      status: 'accepted',
      invitee_user_id: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitation.group_invite_id);

  if (inviteUpdateError) {
    perf.done({ accepted: false, reason: 'action_failed' });
    return NextResponse.json(
      {
        accepted: false,
        group,
        reason: 'action_failed',
      },
      { status: 500 },
    );
  }
  perf.step('invite_marked_accepted');

  await logAppEvent({
    eventName: APP_EVENTS.groupInviteAccepted,
    locale,
    userId: user.id,
    groupId: group.id,
    sessionId: invitation.session_id ?? undefined,
    metadata: {
      invitation_id: invitation.id,
      group_invite_id: invitation.group_invite_id,
      source: invitation.source,
      already_member: verification.alreadyMember,
    },
    useAdmin: true,
  });

  await createInAppNotification({
    admin,
    userId: invitation.invited_by,
    groupId: group.id,
    sessionId: invitation.session_id,
    invitationId: invitation.id,
    type: 'group_invite_accepted',
    targetPath: `/dashboard?groupId=${encodeURIComponent(group.id)}`,
    titleEn: 'Invite accepted',
    titleFr: 'Invitation acceptée',
    bodyEn: `${user.email ?? 'A teammate'} joined "${group.name}".`,
    bodyFr: `${user.email ?? 'Un coéquipier'} a rejoint "${group.name}".`,
  });

  if (!verification.alreadyMember) {
    await createGroupNotifications({
      admin,
      groupId: group.id,
      actorUserId: user.id,
      sessionId: invitation.session_id,
      invitationId: invitation.id,
      type: 'group_member_added',
      targetPath: `/dashboard?groupId=${encodeURIComponent(group.id)}`,
      titleEn: 'New group member',
      titleFr: 'Nouveau membre du groupe',
      bodyEn: `${user.email ?? 'A teammate'} joined "${group.name}".`,
      bodyFr: `${user.email ?? 'Un coéquipier'} a rejoint "${group.name}".`,
    });
  }

  if (invitation.source === 'on_the_fly' && invitation.session_id) {
    await logAppEvent({
      eventName: APP_EVENTS.onTheFlyInviteAccepted,
      locale,
      userId: user.id,
      groupId: group.id,
      sessionId: invitation.session_id,
      metadata: {
        invitation_id: invitation.id,
        group_invite_id: invitation.group_invite_id,
        already_member: verification.alreadyMember,
        funnel_stage: 'accepted',
      },
      useAdmin: true,
    });
  }

  perf.done({
    accepted: true,
    groupId: group.id,
    source: invitation.source,
    alreadyMember: verification.alreadyMember,
  });

  const redirectTo =
    invitation.source === 'on_the_fly' &&
    invitation.session_id &&
    verification.sessionAdmission.reason !== 'session_ended'
      ? `/${locale}/sessions/${invitation.session_id}`
      : `/${locale}/dashboard?groupId=${encodeURIComponent(group.id)}`;

  return NextResponse.json({
    accepted: true,
    group,
    redirectTo,
  });
}
