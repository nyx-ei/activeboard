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
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  isCustomAnswerLetter,
  loadSessionRuntimeAccess,
  precreateQuestionShell,
  resolveSessionQuestion,
} from '@/lib/session/flow';
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
};

function runDeferredTasks(tasks: Array<Promise<unknown>>) {
  void Promise.allSettled(tasks);
}

export async function POST(request: Request, { params }: RouteContext) {
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

  const questionAnswerDeadlineAt = ensuredQuestion.answerDeadlineAt;
  const isExpired = questionAnswerDeadlineAt
    ? new Date(questionAnswerDeadlineAt).getTime() <= Date.now()
    : false;
  perf.step('deadline_checked');

  if (mode === 'timeout' || isExpired) {
    await supabase.schema('public').from('answers').upsert(
      {
        question_id: ensuredQuestion.id,
        user_id: user.id,
        selected_option: '?',
        confidence: null,
      },
      { onConflict: 'question_id,user_id' },
    );
    perf.step('answer_upserted');
    scheduleDashboardProfileAnalyticsRefresh();
    perf.step('deferred_side_effects_started');
    perf.done({ mode: 'timeout', questionId: ensuredQuestion.id });

    return NextResponse.json({
      ok: true,
      mode: 'timeout',
      questionId: ensuredQuestion.id,
      selectedOption: '?',
      confidence: null,
    });
  }

  const resolvedSelectedOption =
    selectedOption === '?' ? customOption : selectedOption;
  await supabase.schema('public').from('answers').upsert(
    {
      question_id: ensuredQuestion.id,
      user_id: user.id,
      selected_option: resolvedSelectedOption,
      confidence,
    },
    { onConflict: 'question_id,user_id' },
  );
  perf.step('answer_upserted');

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
  });

  return NextResponse.json({
    ok: true,
    mode: 'submitted',
    questionId: ensuredQuestion.id,
    selectedOption: resolvedSelectedOption,
    confidence,
  });
}
