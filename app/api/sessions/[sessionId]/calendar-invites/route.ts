import { NextResponse } from 'next/server';

import { hasEmailEnv } from '@/lib/env';
import { sendSessionCalendarInvites } from '@/lib/notifications/calendar-invites';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = {
  params: { sessionId: string };
};

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;

  if (!hasEmailEnv()) {
    return NextResponse.json(
      { ok: false, reason: 'email_not_configured' },
      { status: 503 },
    );
  }

  const { user } = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select(
      'id, group_id, name, scheduled_at, share_code, meeting_link, timer_seconds',
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: 'session_not_found' },
      { status: 404 },
    );
  }

  const { data: membership } = await admin
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: 'not_authorized' },
      { status: 403 },
    );
  }

  const result = await sendSessionCalendarInvites(session);

  return NextResponse.json({
    ok: true,
    attempted: result.attempted,
    sent: result.sent,
  });
}
