import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';
import { recordSessionStateEvent } from '@/lib/session/state-events';

type RouteContext = {
  params: { sessionId: string };
};

type AdvancePayload = {
  locale?: string;
  questionIndex?: number;
};
type AdvanceSessionQuestionResult = {
  ok: boolean | null;
  code: string | null;
  question_id: string | null;
  question_index: number | null;
  answer_deadline_at: string | null;
  session_status: string | null;
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request
    .json()
    .catch(() => null)) as AdvancePayload | null;
  const locale = (body?.locale ?? 'en') as AppLocale;
  const questionIndex = Number(body?.questionIndex);
  const perf = createPerfTracker(
    `advanceSessionQuestionRoute:${sessionId}:${questionIndex}`,
    {
      sessionId,
      minDurationMs: 250,
      metadata: {
        trace_group: 'sessions',
        trace_kind: 'advance_question',
      },
    },
  );
  perf.step('request_parsed');

  let feedbackTranslations: Awaited<ReturnType<typeof getTranslations>> | null =
    null;
  const getFeedback = async (key: string) => {
    feedbackTranslations ??= await getTranslations({
      locale,
      namespace: 'Feedback',
    });
    return feedbackTranslations(key);
  };

  if (!sessionId || !Number.isInteger(questionIndex) || questionIndex < 0) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 400 },
    );
  }

  const { supabase, user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        redirectTo: `/${locale}/auth/login`,
        message: await getFeedback('notAuthorized'),
      },
      { status: 401 },
    );
  }

  const access = await loadSessionRuntimeAccess(
    supabase,
    sessionId,
    user.id,
    false,
  );
  perf.step('session_loaded');
  const session = getSessionAccessSnapshot(access);

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        redirectTo: `/${locale}/dashboard`,
        message: await getFeedback('notAuthorized'),
      },
      { status: 403 },
    );
  }

  perf.setContext({
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'advance_question',
      question_index: questionIndex,
    },
  });

  if (session.leader_id !== user.id) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('captainOnlyAction') },
      { status: 403 },
    );
  }

  if (session.status !== 'active' || questionIndex >= session.question_goal) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 400 },
    );
  }

  try {
    if (session.timer_mode === 'per_question') {
      const { data: currentQuestion, error: currentQuestionError } =
        await supabase
          .schema('public')
          .from('questions')
          .select('id, phase')
          .eq('session_id', sessionId)
          .eq('order_index', questionIndex)
          .maybeSingle();

      if (currentQuestionError || !currentQuestion?.id) {
        throw new Error(
          currentQuestionError?.message ?? 'current_question_missing',
        );
      }

      const { error: reviewPhaseError } = await supabase
        .schema('public')
        .from('questions')
        .update({ phase: 'review' })
        .eq('id', currentQuestion.id)
        .neq('phase', 'closed');

      if (reviewPhaseError) {
        throw new Error(reviewPhaseError.message ?? 'review_phase_failed');
      }

      const reviewHref = `/${locale}/sessions/${sessionId}?stage=review&q=${questionIndex}`;
      await recordSessionStateEvent(supabase, {
        sessionId,
        groupId: session.group_id,
        questionId: currentQuestion.id,
        actorId: user.id,
        eventType: 'question_advanced',
        payload: {
          eventType: 'question_review_started',
          actorId: user.id,
          questionId: currentQuestion.id,
          questionIndex,
          href: reviewHref,
        },
      }).catch(() => undefined);
      perf.step('review_state_event_recorded');
      perf.done({ mode: 'review', questionIndex });

      return NextResponse.json({
        ok: true,
        questionId: currentQuestion.id,
        questionIndex,
        redirectTo: reviewHref,
      });
    }

    const { data: advanceRows, error: advanceError } = await (
      supabase.schema('public') as unknown as {
        rpc: (
          fn: 'activeboard_advance_session_question',
          args: {
            target_session_id: string;
            actor_user_id: string;
            current_question_index: number;
          },
        ) => Promise<{
          data: AdvanceSessionQuestionResult[] | null;
          error: { message?: string } | null;
        }>;
      }
    ).rpc('activeboard_advance_session_question', {
      target_session_id: sessionId,
      actor_user_id: user.id,
      current_question_index: questionIndex,
    });

    if (advanceError) {
      throw new Error(advanceError.message ?? 'advance_failed');
    }

    const advanceResult = advanceRows?.[0] ?? null;
    if (!advanceResult?.ok) {
      const feedbackKey =
        advanceResult?.code === 'captainOnlyAction'
          ? 'captainOnlyAction'
          : advanceResult?.code === 'notAuthorized'
            ? 'notAuthorized'
            : 'actionFailed';
      return NextResponse.json(
        { ok: false, message: await getFeedback(feedbackKey) },
        {
          status:
            advanceResult?.code === 'captainOnlyAction' ||
            advanceResult?.code === 'notAuthorized'
              ? 403
              : 400,
        },
      );
    }

    perf.step('advance_rpc_completed');

    if (advanceResult.code === 'sessionCompleted') {
      await recordSessionStateEvent(supabase, {
        sessionId,
        groupId: session.group_id,
        actorId: user.id,
        eventType: 'session_completed',
        payload: {
          eventType: 'session_completed',
          actorId: user.id,
          questionIndex,
        },
      }).catch(() => undefined);
      perf.step('state_event_recorded');
      perf.done({ mode: 'complete' });

      return NextResponse.json({
        ok: true,
        redirectTo: `/${locale}/sessions/${sessionId}?stage=complete`,
      });
    }

    const nextQuestionId = advanceResult.question_id;
    const nextIndex = advanceResult.question_index;
    if (!nextQuestionId || typeof nextIndex !== 'number') {
      throw new Error('advance_missing_question');
    }

    await recordSessionStateEvent(supabase, {
      sessionId,
      groupId: session.group_id,
      questionId: nextQuestionId,
      actorId: user.id,
      eventType: 'question_advanced',
      payload: {
        eventType: 'question_advanced',
        actorId: user.id,
        questionId: nextQuestionId,
        questionIndex: nextIndex,
        answerDeadlineAt: advanceResult.answer_deadline_at,
        href: `/${locale}/sessions/${sessionId}?q=${nextIndex}`,
      },
    }).catch(() => undefined);
    perf.step('state_event_recorded');
    perf.done({ mode: 'next', nextIndex });

    return NextResponse.json({
      ok: true,
      questionId: nextQuestionId,
      questionIndex: nextIndex,
      answerDeadlineAt: advanceResult.answer_deadline_at,
      redirectTo: `/${locale}/sessions/${sessionId}?q=${nextIndex}`,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }
}
