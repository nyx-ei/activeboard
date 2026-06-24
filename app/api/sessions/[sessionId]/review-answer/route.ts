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
  precreateQuestionShell,
} from '@/lib/session/flow';
import { saveReviewSnapshot } from '@/lib/session/review-consistency';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
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
  reviewDurationSeconds?: number;
};

type ReviewSaveResult = {
  question_id: string;
  correct_option: string | null;
  review_version: number | null;
  reviewed_question_count: number | null;
};

type ReviewSaveError = { message?: string } | null;

async function saveReviewSnapshotWithAdmin(input: {
  sessionId: string;
  questionId: string;
  userId: string;
  correctOption: string;
}): Promise<{
  result: ReviewSaveResult | null;
  error: ReviewSaveError;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: question, error: questionLoadError } = await admin
    .schema('public')
    .from('questions')
    .select('id, review_version')
    .eq('id', input.questionId)
    .eq('session_id', input.sessionId)
    .maybeSingle();

  if (questionLoadError || !question) {
    return {
      result: null,
      error: questionLoadError ?? { message: 'question_not_found' },
    };
  }

  const reviewVersion = Number(question.review_version ?? 0) + 1;
  const { error: questionUpdateError } = await admin
    .schema('public')
    .from('questions')
    .update({
      correct_option: input.correctOption,
      phase: 'review',
      review_version: reviewVersion,
    })
    .eq('id', input.questionId)
    .eq('session_id', input.sessionId);

  if (questionUpdateError) {
    return { result: null, error: questionUpdateError };
  }

  const { data: answer, error: answerLoadError } = await admin
    .schema('public')
    .from('answers')
    .select('id, answer_state, selected_option')
    .eq('question_id', input.questionId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (answerLoadError) {
    return { result: null, error: answerLoadError };
  }

  const submittedAnswer =
    answer?.answer_state === 'submitted' && answer.selected_option
      ? answer.selected_option.toUpperCase()
      : null;
  const isCorrect = submittedAnswer
    ? submittedAnswer === input.correctOption
    : null;

  if (answer?.id) {
    const { error: answerUpdateError } = await admin
      .schema('public')
      .from('answers')
      .update({
        review_correct_option: input.correctOption,
        reviewed_at: now,
        is_correct: isCorrect,
      })
      .eq('id', answer.id);

    if (answerUpdateError) {
      return { result: null, error: answerUpdateError };
    }
  } else {
    const { error: answerInsertError } = await admin
      .schema('public')
      .from('answers')
      .insert({
        question_id: input.questionId,
        user_id: input.userId,
        answer_state: 'skipped',
        answer_request_mode: 'timeout',
        answer_request_sequence: 0,
        selected_option: null,
        confidence: null,
        answered_at: now,
        review_correct_option: input.correctOption,
        reviewed_at: now,
        is_correct: null,
      });

    if (answerInsertError) {
      return { result: null, error: answerInsertError };
    }
  }

  const { data: sessionQuestions, error: questionsError } = await admin
    .schema('public')
    .from('questions')
    .select('id')
    .eq('session_id', input.sessionId);

  if (questionsError) {
    return { result: null, error: questionsError };
  }

  const questionIds = sessionQuestions?.map((row) => row.id) ?? [];
  let reviewedQuestionCount = 0;

  if (questionIds.length > 0) {
    const { count, error: countError } = await admin
      .schema('public')
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .not('review_correct_option', 'is', null)
      .in('question_id', questionIds);

    if (countError) {
      return { result: null, error: countError };
    }

    reviewedQuestionCount = count ?? 0;
  }

  return {
    error: null,
    result: {
      question_id: input.questionId,
      correct_option: input.correctOption,
      review_version: reviewVersion,
      reviewed_question_count: reviewedQuestionCount,
    },
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as ReviewPayload | null;
  const locale = (body?.locale ?? 'en') as AppLocale;
  const questionId = body?.questionId?.trim() ?? '';
  const questionIndex = Number(body?.questionIndex);
  const nextQuestionIndex = Number(body?.nextQuestionIndex);
  const advanceAfterSave = body?.advanceAfterSave === true;
  const correctOption = body?.correctOption?.toUpperCase() ?? '';
  const reviewDurationSeconds = Number(body?.reviewDurationSeconds);
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
        redirectTo: `/${locale}/dashboard`,
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

  let { result: reviewResult, error: reviewError } = await saveReviewSnapshot(
    supabase,
    {
      sessionId,
      questionId,
      correctOption,
    },
  );

  if (reviewError) {
    console.error('[session-review] RPC review save failed, using fallback', {
      sessionId,
      questionId,
      questionIndex,
      error: reviewError,
    });
    const fallback = await saveReviewSnapshotWithAdmin({
      sessionId,
      questionId,
      userId: user.id,
      correctOption,
    });
    reviewResult = fallback.result;
    reviewError = fallback.error;
    perf.step('review_snapshot_admin_fallback_saved');
  } else {
    perf.step('review_snapshot_saved');
  }

  if (reviewError) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }

  if (!reviewResult?.question_id) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('reviewQuestionLocked') },
      { status: 409 },
    );
  }
  perf.step('review_updates_saved');
  if (Number.isFinite(reviewDurationSeconds) && reviewDurationSeconds > 0) {
    void (
      supabase.schema('public') as unknown as {
        rpc: (
          fn: 'activeboard_record_review_duration',
          args: {
            target_user_id: string;
            duration_seconds: number;
          },
        ) => Promise<unknown>;
      }
    ).rpc('activeboard_record_review_duration', {
      target_user_id: user.id,
      duration_seconds: Math.min(3600, Math.max(1, Math.round(reviewDurationSeconds))),
    }).catch((error) => {
      console.error('[session-review] failed to record review duration', {
        sessionId,
        questionIndex,
        error,
      });
    });
  }
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
  }).catch((error) => {
    console.error('[session-review] failed to log review event', {
      sessionId,
      questionIndex,
      error,
    });
  });
  perf.step('deferred_side_effects_started');

  const targetQuestionIndex =
    advanceAfterSave && Number.isInteger(nextQuestionIndex)
      ? Math.max(
          0,
          Math.min(nextQuestionIndex, Math.max(session.question_goal - 1, 0)),
        )
      : questionIndex;

  if (
    advanceAfterSave &&
    session.timer_mode === 'per_question' &&
    targetQuestionIndex !== questionIndex
  ) {
    try {
      const admin = createSupabaseAdminClient();
      await precreateQuestionShell(
        admin,
        sessionId,
        targetQuestionIndex,
        user.id,
      );
    } catch (error) {
      console.error('[session-review] failed to prepare next question', {
        sessionId,
        questionIndex,
        targetQuestionIndex,
        error,
      });
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 500 },
      );
    }

    const answerHref = `/${locale}/sessions/${sessionId}?q=${targetQuestionIndex}`;

    perf.step('next_question_shell_created');
    perf.done({
      questionId,
      correctOption,
      targetQuestionIndex,
      reviewVersion: reviewResult.review_version,
      reviewedQuestionCount: reviewResult.reviewed_question_count,
      mode: 'next_question',
    });

    return NextResponse.json({
      ok: true,
      redirectTo: answerHref,
      correctOption,
      targetQuestionIndex,
      reviewVersion: reviewResult.review_version,
      reviewedQuestionCount: reviewResult.reviewed_question_count,
    });
  }

  const redirectTo = `/${locale}/sessions/${sessionId}?stage=review&q=${targetQuestionIndex}`;
  perf.step('response_prepared');
  perf.done({
    questionId,
    correctOption,
    targetQuestionIndex,
    reviewVersion: reviewResult.review_version,
    reviewedQuestionCount: reviewResult.reviewed_question_count,
  });

  return NextResponse.json({
    ok: true,
    redirectTo,
    correctOption,
    targetQuestionIndex,
    reviewVersion: reviewResult.review_version,
    reviewedQuestionCount: reviewResult.reviewed_question_count,
  });
}
