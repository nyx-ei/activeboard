import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { getUserTierCapabilities } from '@/lib/billing/user-tier';
import { createPerfTracker } from '@/lib/observability/perf';
import { createInitialQuestionFast } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = {
  params: { sessionId: string };
};

type StartPayload = {
  locale?: string;
};

type FastStartSessionResult = {
  ok: boolean | null;
  message_key: string | null;
  question_id: string | null;
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as StartPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const perf = createPerfTracker(`startSessionRoute:${sessionId}`, {
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'start_session',
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

  perf.setContext({ locale });
  const supabase = createSupabaseServerClient();
  const { data: fastRows, error: fastError } = await (
    supabase.schema('public') as unknown as {
      rpc: (
        fn: 'activeboard_start_session_self_fast',
        args: { target_session_id: string },
      ) => Promise<{
        data: FastStartSessionResult[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    }
  ).rpc('activeboard_start_session_self_fast', {
    target_session_id: sessionId,
  });
  const fastResult = fastRows?.[0] ?? null;
  if (!fastError && fastResult) {
    perf.step('fast_rpc_completed');

    if (!fastResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: await getFeedback(fastResult.message_key ?? 'actionFailed'),
        },
        {
          status:
            fastResult.message_key === 'notAuthorized' ||
            fastResult.message_key?.startsWith('upgradeRequired')
              ? 403
              : 400,
        },
      );
    }

    perf.done({ questionId: fastResult.question_id, fastPath: true });

    return NextResponse.json({
      ok: true,
      questionId: fastResult.question_id,
      redirectTo: `/${locale}/sessions/${sessionId}?q=0`,
    });
  }

  if (fastError) {
    perf.step(`fast_rpc_unavailable:${fastError.code ?? 'unknown'}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }
  perf.setContext({ userId: user.id, locale });

  const admin = createSupabaseAdminClient();
  const [sessionResult, userTierResult] = await Promise.all([
    admin
      .schema('public')
      .from('sessions')
      .select(
        'id, group_id, status, leader_id, timer_mode, timer_seconds, question_goal, started_at',
      )
      .eq('id', sessionId)
      .maybeSingle(),
    admin
      .schema('public')
      .from('users')
      .select('user_tier')
      .eq('id', user.id)
      .maybeSingle(),
  ]);
  perf.step('session_and_tier_loaded');

  const session = sessionResult.data;
  if (
    !session ||
    !session.group_id ||
    !session.status ||
    !session.timer_mode ||
    typeof session.timer_seconds !== 'number' ||
    typeof session.question_goal !== 'number'
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('notAuthorized') },
      { status: 403 },
    );
  }

  const { data: membership } = await admin
    .schema('public')
    .from('group_members')
    .select('user_id')
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

  const userTier = userTierResult.data?.user_tier ?? 'locked';
  if (!getUserTierCapabilities(userTier).canJoinSessions) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('upgradeRequiredToJoinSession') },
      { status: 403 },
    );
  }

  let fallbackQuestionId: string | null = null;
  if (session.status === 'scheduled' || session.status === 'incomplete') {
    const startedAt = session.started_at ?? new Date().toISOString();
    try {
      const [, question] = await Promise.all([
        admin
          .schema('public')
          .from('sessions')
          .update({
            status: 'active',
            started_at: startedAt,
            leader_id: session.leader_id ?? user.id,
          })
          .eq('id', sessionId),
        createInitialQuestionFast(admin, sessionId, user.id, {
          timer_mode: session.timer_mode,
          timer_seconds: session.timer_seconds,
          started_at: startedAt,
        }),
      ]);
      perf.step('session_started');
      perf.done({ questionId: question.id });
      fallbackQuestionId = question.id;
    } catch {
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    questionId: fallbackQuestionId,
    redirectTo: `/${locale}/sessions/${sessionId}?q=0`,
  });
}
