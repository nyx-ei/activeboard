import { NextResponse } from 'next/server';

import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};
type SessionRuntimeSnapshot = {
  ok: boolean | null;
  session_status: string | null;
  question_id: string | null;
  question_index: number | null;
  question_phase: string | null;
  answer_deadline_at: string | null;
  submitted_count: number | null;
  member_count: number | null;
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

  const { data: runtimeRows, error: runtimeError } = await (
    supabase.schema('public') as unknown as {
      rpc: (
        fn: 'activeboard_get_session_runtime',
        args: {
          target_session_id: string;
          target_question_id: string | null;
        },
      ) => Promise<{
        data: SessionRuntimeSnapshot[] | null;
        error: { message?: string } | null;
      }>;
    }
  ).rpc('activeboard_get_session_runtime', {
    target_session_id: sessionId,
    target_question_id: questionId,
  });
  perf.step('runtime_snapshot_loaded');

  const runtime = runtimeRows?.[0] ?? null;
  if (runtimeError || !runtime?.ok || !runtime.session_status) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  perf.step('membership_loaded');
  perf.done({
    mode: questionId ? 'question' : 'latest',
    questionFound: Boolean(runtime.question_id),
    submittedCount: runtime.submitted_count ?? 0,
    memberCount: runtime.member_count ?? 0,
  });

  return NextResponse.json({
    ok: true,
    sessionStatus: runtime.session_status,
    questionId: runtime.question_id ?? null,
    questionIndex: runtime.question_index ?? null,
    questionPhase: runtime.question_phase ?? null,
    answerDeadlineAt: runtime.answer_deadline_at ?? null,
    submittedCount: runtime.submitted_count ?? 0,
    memberCount: runtime.member_count ?? 0,
  });
}
