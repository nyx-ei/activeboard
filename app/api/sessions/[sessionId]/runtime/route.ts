import { NextResponse } from 'next/server';

import { createPerfTracker } from '@/lib/observability/perf';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = {
  params: { sessionId: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  const questionId = new URL(request.url).searchParams.get('questionId');
  const sessionId = params.sessionId;
  const perf = createPerfTracker(`sessionRuntime:${sessionId}:${questionId ?? 'latest'}`);

  if (!sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, status')
    .eq('id', sessionId)
    .maybeSingle();
  perf.step('session_loaded');

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();
  perf.step('membership_loaded');

  if (!membership) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (questionId) {
    const [{ data: question }, { count: memberCount }, { count: submittedCount }] = await Promise.all([
      supabase
        .schema('public')
        .from('questions')
        .select('id, phase, answer_deadline_at')
        .eq('id', questionId)
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .schema('public')
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', session.group_id),
      supabase
        .schema('public')
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', questionId),
    ]);
    perf.step('question_and_counts_loaded');
    perf.done({
      mode: 'question',
      questionFound: Boolean(question?.id),
      submittedCount: submittedCount ?? 0,
      memberCount: memberCount ?? 0,
    });

    return NextResponse.json({
      ok: true,
      sessionStatus: session.status,
      questionId: question?.id ?? null,
      questionPhase: question?.phase ?? null,
      answerDeadlineAt: question?.answer_deadline_at ?? null,
      submittedCount: submittedCount ?? 0,
      memberCount: memberCount ?? 0,
    });
  }

  const [{ data: question }, { count: memberCount }] = await Promise.all([
    supabase
      .schema('public')
      .from('questions')
      .select('id, phase, answer_deadline_at')
      .eq('session_id', sessionId)
      .not('launched_at', 'is', null)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', session.group_id),
  ]);
  perf.step('latest_question_loaded');
  perf.done({
    mode: 'latest',
    questionFound: Boolean(question?.id),
    memberCount: memberCount ?? 0,
  });

  return NextResponse.json({
    ok: true,
    sessionStatus: session.status,
    questionId: question?.id ?? null,
    questionPhase: question?.phase ?? null,
    answerDeadlineAt: question?.answer_deadline_at ?? null,
    submittedCount: 0,
    memberCount: memberCount ?? 0,
  });
}
