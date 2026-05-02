import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  ensureQuestion,
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};

type AdvancePayload = {
  locale?: string;
  questionIndex?: number;
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
        redirectTo: `/${locale}/dashboard?view=sessions`,
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

  if (session.status !== 'active' || questionIndex >= session.question_goal) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 400 },
    );
  }

  const nextIndex = questionIndex + 1;
  if (nextIndex >= session.question_goal) {
    await supabase
      .schema('public')
      .from('sessions')
      .update({ status: 'incomplete' })
      .eq('id', sessionId);
    perf.step('session_marked_incomplete');
    perf.done({ mode: 'complete' });

    return NextResponse.json({
      ok: true,
      redirectTo: `/${locale}/sessions/${sessionId}?stage=complete`,
    });
  }

  try {
    const nextQuestion = await ensureQuestion(
      supabase,
      sessionId,
      nextIndex,
      user.id,
      session,
    );
    perf.step('next_question_ready');
    perf.done({ mode: 'next', nextIndex });

    return NextResponse.json({
      ok: true,
      questionId: nextQuestion.id,
      questionIndex: nextIndex,
      answerDeadlineAt: nextQuestion.answerDeadlineAt,
      redirectTo: `/${locale}/sessions/${sessionId}?q=${nextIndex}`,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }
}
