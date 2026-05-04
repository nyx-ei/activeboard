import { NextResponse } from 'next/server';

import { computeAnswerDistribution } from '@/lib/demo/distribution';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const url = new URL(request.url);
  const questionIndex = Number(url.searchParams.get('q'));
  const perf = createPerfTracker(
    `reviewQuestionRoute:${sessionId}:${questionIndex}`,
    {
      sessionId,
      minDurationMs: 250,
      metadata: {
        trace_group: 'sessions',
        trace_kind: 'review_question',
      },
    },
  );

  if (!sessionId || !Number.isInteger(questionIndex) || questionIndex < 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { supabase, user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const access = await loadSessionRuntimeAccess(supabase, sessionId, user.id);
  const session = getSessionAccessSnapshot(access);
  perf.step('session_loaded');

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const clampedIndex = Math.max(
    0,
    Math.min(questionIndex, Math.max(session.question_goal - 1, 0)),
  );
  const [{ data: question }, { count: reviewedQuestionCount }] =
    await Promise.all([
      supabase
        .schema('public')
        .from('questions')
        .select(
          'id, body, options, order_index, phase, launched_at, answer_deadline_at, correct_option',
        )
        .eq('session_id', sessionId)
        .eq('order_index', clampedIndex)
        .maybeSingle(),
      supabase
        .schema('public')
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .not('correct_option', 'is', null),
    ]);
  perf.step('question_loaded');

  if (!question?.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { data: answers } = await supabase
    .schema('public')
    .from('answers')
    .select('user_id, selected_option, confidence, is_correct, answered_at')
    .eq('question_id', question.id);
  perf.step('answers_loaded');
  const answerRows = answers ?? [];
  const ownAnswer =
    answerRows.find((answer) => answer.user_id === user.id) ?? null;
  perf.done({
    questionId: question.id,
    questionIndex: clampedIndex,
    answerCount: answerRows.length,
  });

  return NextResponse.json({
    ok: true,
    question,
    distribution: computeAnswerDistribution(
      answerRows,
      access?.member_count ?? 1,
    ),
    ownAnswer: ownAnswer
      ? {
          selected_option: ownAnswer.selected_option,
          confidence: ownAnswer.confidence,
          is_correct: ownAnswer.is_correct,
          answered_at: ownAnswer.answered_at,
        }
      : null,
    reviewedQuestionCount: reviewedQuestionCount ?? 0,
  });
}
