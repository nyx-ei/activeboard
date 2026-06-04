import { NextResponse } from 'next/server';

import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';
import { getReviewQuestionSnapshot } from '@/lib/session/review-consistency';

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
  const clampedQuestionIndex = Math.max(
    0,
    Math.min(questionIndex, Math.max(session.question_goal - 1, 0)),
  );

  const { data: question } = await supabase
    .schema('public')
    .from('questions')
    .select(
      'id, body, options, order_index, phase, launched_at, answer_deadline_at, correct_option, review_version',
    )
    .eq('session_id', sessionId)
    .eq('order_index', clampedQuestionIndex)
    .maybeSingle();
  perf.step('review_snapshot_loaded');

  if (!question?.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { snapshot, error: snapshotError } = await getReviewQuestionSnapshot(
    supabase,
    {
      sessionId,
      questionId: question.id,
    },
  );
  perf.step('review_answers_loaded');

  if (snapshotError || !snapshot) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  perf.done({
    questionId: snapshot.question.id,
    questionIndex: snapshot.question.order_index,
    reviewVersion: snapshot.reviewVersion,
  });

  return NextResponse.json({
    ok: true,
    question: snapshot.question,
    distribution: snapshot.distribution,
    ownAnswer: snapshot.ownAnswer,
    reviewedQuestionCount: snapshot.reviewedQuestionCount,
    reviewVersion: snapshot.reviewVersion,
  });
}
