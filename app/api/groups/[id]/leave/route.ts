import { NextResponse } from 'next/server';

import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = {
  params: { id: string };
};

export async function POST(_request: Request, { params }: RouteContext) {
  const groupId = params.id;
  const perf = createPerfTracker(`dashboardGroupLeaveRoute:${groupId}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'groups',
      trace_kind: 'dashboard_group_leave',
    },
  });

  const { user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' },
      { status: 401 },
    );
  }

  if (!groupId) {
    return NextResponse.json(
      { ok: false, reason: 'missing_fields' },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: membership }, { data: activeSession }] = await Promise.all([
    admin
      .schema('public')
      .from('group_members')
      .select('group_id, user_id, is_founder')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .schema('public')
      .from('sessions')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ]);
  perf.step('leave_context_loaded');

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: 'not_authorized' },
      { status: 403 },
    );
  }

  if (activeSession) {
    return NextResponse.json(
      { ok: false, reason: 'active_session' },
      { status: 409 },
    );
  }

  const { error } = await admin
    .schema('public')
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id);
  perf.step('membership_deleted');

  if (error) {
    return NextResponse.json(
      { ok: false, reason: 'action_failed' },
      { status: 500 },
    );
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupLeft,
    level: 'info',
    userId: user.id,
    groupId,
    metadata: {
      action: 'left_group',
      was_founder: Boolean(membership.is_founder),
    },
    useAdmin: true,
  });

  perf.done({ left: true });

  return NextResponse.json({ ok: true });
}
