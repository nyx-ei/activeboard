import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { refreshDashboardProfileAnalytics } from '@/lib/demo/profile-analytics';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};

type FinishPayload = {
  locale?: string;
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as FinishPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const perf = createPerfTracker(`finishReviewSessionRoute:${sessionId}`, {
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'finish_review',
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

  const access = await loadSessionRuntimeAccess(
    supabase,
    sessionId,
    user.id,
    false,
  );
  const session = getSessionAccessSnapshot(access);
  perf.step('session_loaded');

  if (!session) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('notAuthorized') },
      { status: 403 },
    );
  }

  const { data: sessionQuestions } = await supabase
    .schema('public')
    .from('questions')
    .select('id')
    .eq('session_id', sessionId);

  const sessionQuestionIds = (sessionQuestions ?? []).map(
    (question) => question.id,
  );
  const { count } =
    sessionQuestionIds.length > 0
      ? await supabase
          .schema('public')
          .from('answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('question_id', sessionQuestionIds)
          .not('review_correct_option', 'is', null)
      : { count: 0 };
  perf.step('review_count_loaded');

  if ((count ?? 0) < session.question_goal) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('missingFields') },
      { status: 400 },
    );
  }

  const { data: plannedNextSession } = await supabase
    .schema('public')
    .from('sessions')
    .select('id')
    .eq('group_id', session.group_id)
    .eq('status', 'scheduled')
    .neq('id', sessionId)
    .gte('scheduled_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  perf.step('next_session_loaded');

  if (!plannedNextSession?.id) {
    return NextResponse.json(
      {
        ok: false,
        message:
          locale === 'fr'
            ? 'Planifie la prochaine session avant de terminer.'
            : 'Schedule the next session before finishing.',
      },
      { status: 409 },
    );
  }

  await supabase
    .schema('public')
    .from('sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  perf.step('session_completed');

  void supabase
    .schema('public')
    .from('session_member_activity')
    .upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        attendance_status: 'present',
        participated_in_review: true,
        planned_next_session: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' },
    );

  void Promise.allSettled([
    logAppEvent({
      eventName: APP_EVENTS.sessionEnded,
      locale,
      userId: user.id,
      groupId: session.group_id,
      sessionId,
      metadata: {
        ended_by: user.id,
        source: 'review_flow',
      },
    }),
    refreshDashboardProfileAnalytics(),
  ]);
  perf.step('deferred_side_effects_started');
  perf.done({ reviewedQuestionCount: count ?? 0 });

  return NextResponse.json({
    ok: true,
    redirectTo: `/${locale}/dashboard`,
    message: await getFeedback('sessionCompleted'),
  });
}
