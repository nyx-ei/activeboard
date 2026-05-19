import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { isConfidenceLevel } from '@/lib/demo/confidence';
import { scheduleDashboardProfileAnalyticsRefresh } from '@/lib/demo/profile-analytics';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendTrialWarningEmailIfNeeded } from '@/lib/notifications/trial-progress';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  decideAnswerDeadline,
  hasQuestionAdvanced,
} from '@/lib/session/deadline-policy';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  isCustomAnswerLetter,
  loadSessionRuntimeAccess,
  precreateQuestionShell,
  resolveSessionQuestion,
} from '@/lib/session/flow';
import { recordSessionStateEvent } from '@/lib/session/state-events';
import { ANSWER_OPTIONS } from '@/lib/types/demo';

type RouteContext = {
  params: { sessionId: string };
};

type SubmitPayload = {
  locale?: string;
  questionId?: string | null;
  questionIndex?: number;
  selectedOption?: string | null;
  customOption?: string | null;
  confidence?: string | null;
  mode?: 'submit' | 'timeout';
  requestSequence?: number;
};

type ConcurrentAnswerSaveResult = {
  applied: boolean | null;
  selected_option: string | null;
  confidence: string | null;
  answer_state: 'submitted' | 'skipped' | null;
  request_sequence: number | null;
  request_mode: 'submit' | 'timeout' | null;
};

function runDeferredTasks(tasks: Array<Promise<unknown>>) {
  void Promise.allSettled(tasks);
}

export async function POST(request: Request, { params }: RouteContext) {
  const requestReceivedAtMs = Date.now();
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as SubmitPayload | null;
  const locale = (body?.locale ?? 'en') as AppLocale;
  const questionId = body?.questionId?.trim() || null;
  const questionIndex = Number(body?.questionIndex);
  const selectedOption = body?.selectedOption?.toUpperCase() ?? '';
  const customOption = body?.customOption?.trim().toUpperCase() ?? '';
  const confidenceValue = body?.confidence;
  const confidence =
    typeof confidenceValue === 'string' && isConfidenceLevel(confidenceValue)
      ? confidenceValue
      : null;
  const mode = body?.mode === 'timeout' ? 'timeout' : 'submit';
  const requestSequence =
    typeof body?.requestSequence === 'number' &&
    Number.isFinite(body.requestSequence)
      ? Math.max(0, Math.trunc(body.requestSequence))
      : Date.now();
  const perf = createPerfTracker(
    `submitSessionAnswerRoute:${sessionId}:${questionIndex}`,
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

  const lateSubmitResponse = async (reason: string) =>
    NextResponse.json(
      {
        ok: false,
        code: 'answer_window_closed',
        reason,
        retryable: false,
        refetch: true,
        message: await getFeedback('answerWindowClosed'),
      },
      { status: 409 },
    );

  if (!sessionId) {
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
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'answer_submit',
      question_id: questionId,
      question_index: questionIndex,
      submit_mode: mode,
    },
  });
  perf.step('membership_loaded');

  if (
    session.status !== 'active' ||
    !Number.isInteger(questionIndex) ||
    questionIndex < 0 ||
    questionIndex >= session.question_goal
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 400 },
    );
  }

  if (
    mode === 'submit' &&
    ((!ANSWER_OPTIONS.includes(
      selectedOption as (typeof ANSWER_OPTIONS)[number],
    ) &&
      selectedOption !== '?') ||
      (selectedOption === '?' &&
        (!isCustomAnswerLetter(customOption) ||
          ANSWER_OPTIONS.includes(
            customOption as (typeof ANSWER_OPTIONS)[number],
          ))) ||
      !confidence)
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('missingFields') },
      { status: 400 },
    );
  }
  perf.step('payload_validated');

  let ensuredQuestion: { id: string; answerDeadlineAt: string | null };
  try {
    ensuredQuestion = await resolveSessionQuestion(supabase, {
      sessionId,
      questionId,
      questionIndex,
      userId: user.id,
      session,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }
  perf.step('question_ensured');

  const [
    { data: questionState },
    { data: latestQuestion },
    { data: existingAnswer },
  ] = await Promise.all([
    supabase
      .schema('public')
      .from('questions')
      .select('id, order_index, phase, answer_deadline_at')
      .eq('id', ensuredQuestion.id)
      .eq('session_id', sessionId)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('questions')
      .select('order_index')
      .eq('session_id', sessionId)
      .not('launched_at', 'is', null)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('answers')
      .select('answer_state, selected_option, confidence')
      .eq('question_id', ensuredQuestion.id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  const questionAnswerDeadlineAt =
    questionState?.answer_deadline_at ?? ensuredQuestion.answerDeadlineAt;
  const deadlineDecision = decideAnswerDeadline({
    deadlineAt: questionAnswerDeadlineAt,
    mode,
    requestReceivedAtMs,
  });
  perf.step('deadline_checked');

  if (
    !questionState?.id ||
    questionState.phase !== 'answering' ||
    hasQuestionAdvanced(questionIndex, latestQuestion?.order_index ?? null)
  ) {
    return lateSubmitResponse('question_advanced');
  }

  if (!deadlineDecision.accepted) {
    return lateSubmitResponse(deadlineDecision.reason);
  }

  const saveAnswer = async (
    requestMode: 'submit' | 'timeout',
    option: string | null,
    answerConfidence: string | null,
  ) =>
    (
      supabase.schema('public') as unknown as {
        rpc: (
          fn: 'activeboard_save_session_answer_concurrent',
          args: {
            target_question_id: string;
            selected_option_input: string | null;
            confidence_input: string | null;
            request_sequence_input: number;
            request_mode_input: 'submit' | 'timeout';
          },
        ) => Promise<{
          data: ConcurrentAnswerSaveResult[] | null;
          error: { message?: string } | null;
        }>;
      }
    ).rpc('activeboard_save_session_answer_concurrent', {
      target_question_id: ensuredQuestion.id,
      selected_option_input: option,
      confidence_input: answerConfidence,
      request_sequence_input: requestSequence,
      request_mode_input: requestMode,
    });

  if (mode === 'timeout') {
    if (existingAnswer?.selected_option) {
      perf.done({
        mode: 'timeout_existing_answer',
        questionId: ensuredQuestion.id,
      });

      return NextResponse.json({
        ok: true,
        mode: 'timeout',
        questionId: ensuredQuestion.id,
        selectedOption: existingAnswer.selected_option,
        confidence: existingAnswer.confidence,
        answerState: existingAnswer.answer_state ?? 'submitted',
        deadlinePolicy: deadlineDecision.reason,
      });
    }

    const { data: saveRows, error: saveError } = await saveAnswer(
      'timeout',
      null,
      null,
    );

    if (saveError) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 500 },
      );
    }
    const savedAnswer = saveRows?.[0] ?? null;
    perf.step('answer_upserted');
    await recordSessionStateEvent(supabase, {
      sessionId,
      groupId: session.group_id,
      questionId: ensuredQuestion.id,
      actorId: user.id,
      eventType: 'answer_timed_out',
    }).catch(() => undefined);
    perf.step('state_event_recorded');
    scheduleDashboardProfileAnalyticsRefresh();
    perf.step('deferred_side_effects_started');
    perf.done({ mode: 'timeout', questionId: ensuredQuestion.id });

    return NextResponse.json({
      ok: true,
      mode: savedAnswer?.request_mode ?? 'timeout',
      questionId: ensuredQuestion.id,
      selectedOption: savedAnswer?.selected_option ?? null,
      confidence: savedAnswer?.confidence ?? null,
      applied: Boolean(savedAnswer?.applied),
      answerState: savedAnswer?.answer_state ?? 'skipped',
      deadlinePolicy: deadlineDecision.reason,
    });
  }

  const resolvedSelectedOption =
    selectedOption === '?' ? customOption : selectedOption;
  const { data: saveRows, error: saveError } = await saveAnswer(
    'submit',
    resolvedSelectedOption,
    confidence,
  );

  if (saveError) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }
  const savedAnswer = saveRows?.[0] ?? null;
  if (savedAnswer?.request_mode === 'timeout') {
    return NextResponse.json({
      ok: true,
      mode: 'timeout',
      questionId: ensuredQuestion.id,
      selectedOption: savedAnswer.selected_option,
      confidence: null,
      answerState: savedAnswer.answer_state ?? 'skipped',
      deadlinePolicy: deadlineDecision.reason,
      applied: false,
    });
  }
  perf.step('answer_upserted');
  await recordSessionStateEvent(supabase, {
    sessionId,
    groupId: session.group_id,
    questionId: ensuredQuestion.id,
    actorId: user.id,
    eventType: 'answer_submitted',
  }).catch(() => undefined);
  perf.step('state_event_recorded');

  runDeferredTasks([
    questionIndex + 1 < session.question_goal
      ? precreateQuestionShell(supabase, sessionId, questionIndex + 1, user.id)
      : Promise.resolve(),
    logAppEvent({
      eventName: APP_EVENTS.answerSubmitted,
      locale,
      userId: user.id,
      groupId: session.group_id,
      sessionId,
      metadata: {
        question_id: ensuredQuestion.id,
        question_index: questionIndex,
        selected_option: resolvedSelectedOption,
        confidence,
        source: 'self_paced_session_flow',
      },
    }),
    sendTrialWarningEmailIfNeeded(user.id),
  ]);
  scheduleDashboardProfileAnalyticsRefresh();
  perf.step('deferred_side_effects_started');
  perf.done({
    mode: 'submitted',
    questionId: ensuredQuestion.id,
    selectedOption: resolvedSelectedOption,
    confidence,
    deadlinePolicy: deadlineDecision.reason,
  });

  return NextResponse.json({
    ok: true,
    mode: 'submitted',
    questionId: ensuredQuestion.id,
    selectedOption: savedAnswer?.selected_option ?? resolvedSelectedOption,
    confidence: (savedAnswer?.confidence as typeof confidence) ?? confidence,
    applied: Boolean(savedAnswer?.applied),
    answerState: savedAnswer?.answer_state ?? 'submitted',
    deadlinePolicy: deadlineDecision.reason,
  });
}
