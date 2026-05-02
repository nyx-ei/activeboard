import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};

type CancelPayload = {
  locale?: string;
  returnTo?: string;
};

function groupDashboardPath(locale: AppLocale, groupId: string) {
  return `/${locale}/groups/${groupId}`;
}

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as CancelPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const returnTo = body?.returnTo ?? '';
  const perf = createPerfTracker(`cancelSessionRoute:${sessionId}`, {
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'cancel_session',
    },
  });
  let feedbackTranslations: Awaited<ReturnType<typeof getTranslations>> | null =
    null;
  const getFeedback = async (key: string) => {
    feedbackTranslations ??= await getTranslations({
      locale,
      namespace: 'Feedback',
    });
    return feedbackTranslations(key);
  };

  const { supabase, user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, leader_id, created_by, status')
    .eq('id', sessionId)
    .maybeSingle();
  perf.step('session_loaded');

  const sessionReturnPath =
    session && returnTo === groupDashboardPath(locale, session.group_id)
      ? returnTo
      : `/${locale}/dashboard?view=sessions`;

  if (!session) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 404 },
    );
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();
  perf.step('membership_loaded');

  if (
    !membership ||
    (session.leader_id !== user.id &&
      session.created_by !== user.id &&
      !membership.is_founder)
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('deleteSessionNotAuthorized') },
      { status: 403 },
    );
  }

  const { data: cancelledSession, error } = await supabase
    .schema('public')
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('id', sessionId)
    .select('id')
    .maybeSingle();
  perf.step('session_cancelled');

  if (error || !cancelledSession) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }

  void logAppEvent({
    eventName: APP_EVENTS.sessionEnded,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      source:
        sessionReturnPath === groupDashboardPath(locale, session.group_id)
          ? 'group_page_session_delete_icon'
          : 'dashboard_session_delete_icon',
      previous_status: session.status,
      new_status: 'cancelled',
    },
  });
  perf.step('deferred_side_effects_started');
  perf.done({ previousStatus: session.status });

  return NextResponse.json({
    ok: true,
    message: await getFeedback('actionSucceeded'),
    redirectTo: sessionReturnPath,
  });
}
