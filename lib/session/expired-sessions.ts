import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

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

  const { data, error } = await admin
    .schema('public')
    .from('sessions')
    .update({ status: 'expired' })
    .in('group_id', uniqueGroupIds)
    .eq('status', 'scheduled')
    .lt('scheduled_at', getStartOfTodayUtc().toISOString())
    .select('id');

  if (error) {
    console.error('[sessions] failed to expire past scheduled sessions', {
      error,
    });
    return 0;
  }

  return data?.length ?? 0;
}

export async function expirePastScheduledSession(sessionId: string) {
  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select('id, status, scheduled_at')
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

  if (!isPastScheduledDay(session.scheduled_at)) {
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
