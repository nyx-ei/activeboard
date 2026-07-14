import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
const SESSION_START_GRACE_MS = 30 * 60 * 1000;

function getStartOfTodayUtc() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function isPastScheduledDay(scheduledAt: string | null | undefined) {
  if (!scheduledAt) {
    return false;
  }

  const scheduledDate = new Date(scheduledAt);
  if (!Number.isFinite(scheduledDate.getTime())) {
    return false;
  }

  return scheduledDate.getTime() < getStartOfTodayUtc().getTime();
}

export function isMissedScheduledSession({
  scheduledAt,
  meetingLink,
}: {
  scheduledAt: string | null | undefined;
  meetingLink?: string | null;
}) {
  if (!scheduledAt) {
    return false;
  }

  const scheduledTime = new Date(scheduledAt).getTime();
  if (!Number.isFinite(scheduledTime)) {
    return false;
  }

  if (meetingLink) {
    return scheduledTime + SESSION_START_GRACE_MS < Date.now();
  }

  return isPastScheduledDay(scheduledAt);
}

export async function expirePastScheduledSessionsForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: memberships } = await admin
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  const groupIds = [
    ...new Set(
      (memberships ?? [])
        .map((membership) => membership.group_id)
        .filter((groupId): groupId is string => Boolean(groupId)),
    ),
  ];

  if (groupIds.length === 0) {
    return 0;
  }

  return expirePastScheduledSessionsForGroups(admin, groupIds);
}

export async function expirePastScheduledSessionsForGroups(
  admin: AdminClient,
  groupIds: string[],
) {
  const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))];
  if (uniqueGroupIds.length === 0) {
    return 0;
  }

  const scheduledDayCutoff = getStartOfTodayUtc().toISOString();
  const plannedTimeCutoff = new Date(
    Date.now() - SESSION_START_GRACE_MS,
  ).toISOString();

  const { data: expiredUnplanned, error: unplannedError } = await admin
    .schema('public')
    .from('sessions')
    .update({ status: 'expired' })
    .in('group_id', uniqueGroupIds)
    .eq('status', 'scheduled')
    .is('meeting_link', null)
    .lt('scheduled_at', scheduledDayCutoff)
    .select('id');

  if (unplannedError) {
    console.error('[sessions] failed to expire past scheduled sessions', {
      error: unplannedError,
    });
  }

  const { data: expiredPlanned, error: plannedError } = await admin
    .schema('public')
    .from('sessions')
    .update({ status: 'expired' })
    .in('group_id', uniqueGroupIds)
    .eq('status', 'scheduled')
    .not('meeting_link', 'is', null)
    .lt('scheduled_at', plannedTimeCutoff)
    .select('id');

  if (plannedError) {
    console.error('[sessions] failed to expire missed planned sessions', {
      error: plannedError,
    });
  }

  return (expiredUnplanned?.length ?? 0) + (expiredPlanned?.length ?? 0);
}

export async function expirePastScheduledSession(sessionId: string) {
  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select('id, status, scheduled_at, meeting_link')
    .eq('id', sessionId)
    .maybeSingle();

  if (
    !session ||
    (session.status !== 'scheduled' && session.status !== 'expired')
  ) {
    return false;
  }

  if (session.status === 'expired') {
    return true;
  }

  if (
    !isMissedScheduledSession({
      scheduledAt: session.scheduled_at,
      meetingLink: session.meeting_link,
    })
  ) {
    return false;
  }

  const { error } = await admin
    .schema('public')
    .from('sessions')
    .update({ status: 'expired' })
    .eq('id', sessionId)
    .eq('status', 'scheduled');

  if (error) {
    console.error('[sessions] failed to expire past scheduled session', {
      sessionId,
      error,
    });
    return false;
  }

  return true;
}
