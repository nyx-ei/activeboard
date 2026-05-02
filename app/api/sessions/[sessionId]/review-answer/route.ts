import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';
import { ANSWER_OPTIONS } from '@/lib/types/demo';

type RouteContext = {
  params: { sessionId: string };
};

type ReviewPayload = {
  locale?: string;
  questionId?: string | null;
  questionIndex?: number;
  nextQuestionIndex?: number;
  advanceAfterSave?: boolean;
  correctOption?: string | null;
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as ReviewPayload | null;
  const locale = (body?.locale ?? 'en') as AppLocale;
  const questionId = body?.questionId?.trim() ?? '';
  const questionIndex = Number(body?.questionIndex);
  const nextQuestionIndex = Number(body?.nextQuestionIndex);
  const advanceAfterSave = body?.advanceAfterSave === true;
  const correctOption = body?.correctOption?.toUpperCase() ?? '';
  const perf = createPerfTracker(
    `saveReviewAnswerRoute:${sessionId}:${questionIndex}`,
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

  if (
    !sessionId ||
    !questionId ||
    !Number.isInteger(questionIndex) ||
    questionIndex < 0
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 400 },
    );
  }

  if (
    !ANSWER_OPTIONS.includes(correctOption as (typeof ANSWER_OPTIONS)[number])
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('missingFields') },
      { status: 400 },
    );
  }
  perf.step('payload_validated');

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
        redirectTo: `/${locale}/dashboard?view=sessions`,
        message: await getFeedback('notAuthorized'),
      },
      { status: 403 },
    );
  }
  perf.setContext({
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'review_save',
      question_id: questionId,
      question_index: questionIndex,
      advance_after_save: advanceAfterSave,
    },
  });
  perf.step('membership_loaded');

  if (
    session.status !== 'incomplete' &&
    session.status !== 'active' &&
    session.status !== 'completed'
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 400 },
    );
  }
  perf.step('session_validated');

  const { data: updatedQuestion } = await supabase
    .schema('public')
    .from('questions')
    .update({ correct_option: correctOption, phase: 'review' })
    .eq('id', questionId)
    .eq('session_id', sessionId)
    .select('id')
    .maybeSingle();
  perf.step('question_updated');

  if (!updatedQuestion?.id) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('notAuthorized') },
      { status: 403 },
    );
  }

  await Promise.all([
    supabase
      .schema('public')
      .from('answers')
      .update({ is_correct: true })
      .eq('question_id', questionId)
      .eq('selected_option', correctOption),
    supabase
      .schema('public')
      .from('answers')
      .update({ is_correct: false })
      .eq('question_id', questionId)
      .neq('selected_option', correctOption),
  ]);
  perf.step('review_updates_saved');

  void logAppEvent({
    eventName: APP_EVENTS.answerRevealed,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      question_id: questionId,
      correct_option: correctOption,
      source: 'review_flow',
    },
  });
  perf.step('deferred_side_effects_started');

  const targetQuestionIndex =
    advanceAfterSave && Number.isInteger(nextQuestionIndex)
      ? Math.max(
          0,
          Math.min(nextQuestionIndex, Math.max(session.question_goal - 1, 0)),
        )
      : questionIndex;

  const redirectTo = `/${locale}/sessions/${sessionId}?stage=review&q=${targetQuestionIndex}`;
  perf.step('response_prepared');
  perf.done({
    questionId,
    correctOption,
    targetQuestionIndex,
  });

  return NextResponse.json({
    ok: true,
    redirectTo,
    correctOption,
    targetQuestionIndex,
  });
}
