import { NextResponse } from 'next/server';

import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  const questionId = new URL(request.url).searchParams.get('questionId');
  const sessionId = params.sessionId;
  const perf = createPerfTracker(
    `sessionRuntime:${sessionId}:${questionId ?? 'latest'}`,
  );

  if (!sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { supabase, user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  perf.setContext({
    userId: user.id,
    sessionId,
    sampleRate: 0.2,
    minDurationMs: 1200,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'runtime',
      question_id: questionId,
    },
  });

  const access = await loadSessionRuntimeAccess(supabase, sessionId, user.id);
  perf.step('session_loaded');

  if (!access?.session_id || !access.status) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  perf.step('membership_loaded');

  if (questionId) {
    const [{ data: question }, { count: submittedCount }] = await Promise.all([
      supabase
        .schema('public')
        .from('questions')
        .select('id, phase, answer_deadline_at')
        .eq('id', questionId)
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .schema('public')
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('question_id', questionId),
    ]);
    perf.step('question_and_counts_loaded');
    perf.done({
      mode: 'question',
      questionFound: Boolean(question?.id),
      submittedCount: submittedCount ?? 0,
      memberCount: access.member_count ?? 0,
    });

    return NextResponse.json({
      ok: true,
      sessionStatus: access.status,
      questionId: question?.id ?? null,
      questionPhase: question?.phase ?? null,
      answerDeadlineAt: question?.answer_deadline_at ?? null,
      submittedCount: submittedCount ?? 0,
      memberCount: access.member_count ?? 0,
    });
  }

  const { data: question } = await supabase
    .schema('public')
    .from('questions')
    .select('id, phase, answer_deadline_at')
    .eq('session_id', sessionId)
    .not('launched_at', 'is', null)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  perf.step('latest_question_loaded');
  perf.done({
    mode: 'latest',
    questionFound: Boolean(question?.id),
    memberCount: access.member_count ?? 0,
  });

  return NextResponse.json({
    ok: true,
    sessionStatus: access.status,
    questionId: question?.id ?? null,
    questionPhase: question?.phase ?? null,
    answerDeadlineAt: question?.answer_deadline_at ?? null,
    submittedCount: 0,
    memberCount: access.member_count ?? 0,
  });
}
