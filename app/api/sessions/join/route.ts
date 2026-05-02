import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type JoinPayload = {
  locale?: string;
  sessionCode?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as JoinPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const code = body?.sessionCode?.trim().toUpperCase() ?? '';
  const perf = createPerfTracker(`joinSessionByCodeRoute:${code || 'empty'}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'join_by_code',
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

  if (!code) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('invalidSessionCode') },
      { status: 400 },
    );
  }

  const { supabase, user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const [accessState, sessionResult] = await Promise.all([
    getUserAccessState(user.id),
    admin
      .schema('public')
      .from('sessions')
      .select('id, group_id, status')
      .eq('share_code', code)
      .maybeSingle(),
  ]);
  perf.step('session_and_access_loaded');

  if (!hasUserTierCapability(accessState, 'canJoinSessions')) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('upgradeRequiredToJoinSession') },
      { status: 403 },
    );
  }

  const session = sessionResult.data;
  if (!session) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('invalidSessionCode') },
      { status: 404 },
    );
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();
  perf.step('membership_loaded');

  if (!membership) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('notAuthorized') },
      { status: 403 },
    );
  }

  if (session.status === 'completed') {
    return NextResponse.json(
      { ok: false, message: await getFeedback('sessionCompletedHint') },
      { status: 400 },
    );
  }

  if (session.status === 'cancelled' || session.status === 'incomplete') {
    return NextResponse.json(
      { ok: false, message: await getFeedback('sessionInactive') },
      { status: 400 },
    );
  }

  void logAppEvent({
    eventName: APP_EVENTS.sessionJoinedByCode,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId: session.id,
    metadata: {
      join_method: 'share_code',
      share_code: code,
    },
  });
  perf.step('deferred_side_effects_started');
  perf.done({ sessionId: session.id });

  return NextResponse.json({
    ok: true,
    redirectTo: `/${locale}/sessions/${session.id}`,
  });
}
