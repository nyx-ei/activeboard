import 'server-only';

import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type InviteAdmissionFailureReason =
  | 'invite_not_found'
  | 'invite_not_pending'
  | 'email_mismatch'
  | 'upgrade_required'
  | 'group_not_found'
  | 'group_full'
  | 'action_failed';

export type InviteAdmissionSuccess = {
  ok: true;
  invite: {
    id: string;
    groupId: string;
    invitedDuringSessionId: string | null;
  };
  alreadyMember: boolean;
  sessionAdmission: {
    sessionId: string | null;
    allowed: boolean;
    currentQuestionPhase: string | null;
    reason:
      | 'joining_current_question'
      | 'joining_next_question'
      | 'session_ended'
      | null;
  };
};

export type InviteAdmissionFailure = {
  ok: false;
  reason: InviteAdmissionFailureReason;
  status: number;
  sessionAdmission?: {
    sessionId: string | null;
    allowed: false;
    currentQuestionPhase: string | null;
  };
};

export type InviteAdmissionResult =
  | InviteAdmissionSuccess
  | InviteAdmissionFailure;

export function getInviteAdmissionFeedbackKey(
  reason: InviteAdmissionFailureReason,
) {
  switch (reason) {
    case 'upgrade_required':
      return 'upgradeRequiredToJoinGroups' as const;
    case 'group_full':
      return 'groupFull' as const;
    default:
      return 'notAuthorized' as const;
  }
}

export async function verifyInviteAdmission({
  admin,
  inviteId,
  userId,
  userEmail,
}: {
  admin: SupabaseAdminClient;
  inviteId: string;
  userId: string;
  userEmail?: string | null;
}): Promise<InviteAdmissionResult> {
  if (!inviteId) {
    return { ok: false, reason: 'invite_not_found', status: 404 };
  }

  const { data: invite, error: inviteError } = await admin
    .schema('public')
    .from('group_invites')
    .select('id, group_id, invitee_email, status, invited_during_session_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteError) {
    return { ok: false, reason: 'action_failed', status: 500 };
  }

  if (!invite) {
    return { ok: false, reason: 'invite_not_found', status: 404 };
  }

  if (invite.status !== 'pending') {
    return { ok: false, reason: 'invite_not_pending', status: 409 };
  }

  if (
    normalizeEmail(invite.invitee_email) !== normalizeEmail(userEmail ?? '')
  ) {
    return { ok: false, reason: 'email_mismatch', status: 403 };
  }

  const accessState = await getUserAccessState(userId);

  if (!hasUserTierCapability(accessState, 'canJoinMultipleGroups')) {
    return { ok: false, reason: 'upgrade_required', status: 403 };
  }

  const [
    { data: seatAvailability, error: seatAvailabilityError },
    { data: existingMembership, error: membershipError },
  ] = await Promise.all([
    admin
      .schema('public')
      .from('group_seat_availability')
      .select('group_id, seats_available')
      .eq('group_id', invite.group_id)
      .maybeSingle(),
    admin
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', invite.group_id)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (seatAvailabilityError || membershipError) {
    return { ok: false, reason: 'action_failed', status: 500 };
  }

  if (!seatAvailability) {
    return { ok: false, reason: 'group_not_found', status: 404 };
  }

  if (!existingMembership && seatAvailability.seats_available <= 0) {
    return { ok: false, reason: 'group_full', status: 422 };
  }

  if (invite.invited_during_session_id) {
    const { data: session, error: sessionError } = await admin
      .schema('public')
      .from('sessions')
      .select('id, status')
      .eq('id', invite.invited_during_session_id)
      .maybeSingle();

    if (sessionError) {
      return { ok: false, reason: 'action_failed', status: 500 };
    }

    if (session?.status === 'active') {
      const { data: latestQuestion, error: questionError } = await admin
        .schema('public')
        .from('questions')
        .select('id, phase')
        .eq('session_id', session.id)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (questionError) {
        return { ok: false, reason: 'action_failed', status: 500 };
      }

      const currentQuestionPhase = latestQuestion?.phase ?? null;
      const shouldWaitForNextQuestion = currentQuestionPhase === 'review';

      return {
        ok: true,
        invite: {
          id: invite.id,
          groupId: invite.group_id,
          invitedDuringSessionId: invite.invited_during_session_id,
        },
        alreadyMember: Boolean(existingMembership),
        sessionAdmission: {
          sessionId: session.id,
          allowed: !shouldWaitForNextQuestion,
          currentQuestionPhase,
          reason: shouldWaitForNextQuestion
            ? 'joining_next_question'
            : 'joining_current_question',
        },
      };
    }

    if (session?.status === 'scheduled') {
      return {
        ok: true,
        invite: {
          id: invite.id,
          groupId: invite.group_id,
          invitedDuringSessionId: invite.invited_during_session_id,
        },
        alreadyMember: Boolean(existingMembership),
        sessionAdmission: {
          sessionId: session.id,
          allowed: true,
          currentQuestionPhase: null,
          reason: 'joining_current_question',
        },
      };
    }
  }

  return {
    ok: true,
    invite: {
      id: invite.id,
      groupId: invite.group_id,
      invitedDuringSessionId: invite.invited_during_session_id,
    },
    alreadyMember: Boolean(existingMembership),
    sessionAdmission: {
      sessionId: invite.invited_during_session_id,
      allowed: false,
      currentQuestionPhase: null,
      reason: invite.invited_during_session_id ? 'session_ended' : null,
    },
  };
}
