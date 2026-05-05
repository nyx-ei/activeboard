import { NextResponse } from 'next/server';

import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';
import { computeAnswerDistribution } from '@/lib/demo/distribution';

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
  perf.step('session_loaded');

  if (!access) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const session = getSessionAccessSnapshot(access);

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const memberCount = Math.max(access.member_count ?? 1, 1);

  const clampedQuestionIndex = Math.max(
    0,
    Math.min(questionIndex, Math.max(session.question_goal - 1, 0)),
  );

  const [{ data: question }, { count: reviewedQuestionCount }] =
    await Promise.all([
      supabase
        .schema('public')
        .from('questions')
        .select(
          'id, body, options, order_index, phase, launched_at, answer_deadline_at, correct_option, review_version',
        )
        .eq('session_id', sessionId)
        .eq('order_index', clampedQuestionIndex)
        .maybeSingle(),
      supabase
        .schema('public')
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .not('correct_option', 'is', null),
    ]);
  perf.step('review_snapshot_loaded');

  if (!question?.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { data: answers } = await supabase
    .schema('public')
    .from('answers')
    .select(
      'answer_state, selected_option, confidence, is_correct, answered_at, user_id',
    )
    .eq('question_id', question.id);
  perf.step('review_answers_loaded');

  const questionAnswers = answers ?? [];
  const ownAnswer =
    questionAnswers.find((answer) => answer.user_id === user.id) ?? null;
  const distribution = computeAnswerDistribution(questionAnswers, memberCount);

  perf.done({
    questionId: question.id,
    questionIndex: question.order_index,
    reviewVersion: question.review_version ?? 0,
  });

  return NextResponse.json({
    ok: true,
    question,
    distribution,
    ownAnswer: ownAnswer
      ? {
          answer_state: ownAnswer.answer_state,
          selected_option: ownAnswer.selected_option,
          confidence: ownAnswer.confidence,
          is_correct: ownAnswer.is_correct,
          answered_at: ownAnswer.answered_at,
        }
      : null,
    reviewedQuestionCount: reviewedQuestionCount ?? 0,
    reviewVersion: question.review_version ?? 0,
  });
}
