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

  const access = await loadSessionRuntimeAccess(
    supabase,
    sessionId,
    user.id,
    false,
  );
  const session = getSessionAccessSnapshot(access);
  perf.step('session_loaded');

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { snapshot, error } = await getReviewQuestionSnapshot(supabase, {
    sessionId,
    questionIndex,
  });
  perf.step('review_snapshot_loaded');

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (!snapshot?.question.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  perf.done({
    questionId: snapshot.question.id,
    questionIndex: snapshot.question.order_index,
    answerCount: snapshot.answers.length,
    reviewVersion: snapshot.reviewVersion,
  });

  return NextResponse.json({
    ok: true,
    question: snapshot.question,
    answers: snapshot.answers,
    reviewedQuestionCount: snapshot.reviewedQuestionCount,
    reviewVersion: snapshot.reviewVersion,
  });
}
