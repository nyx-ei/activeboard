import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ANSWER_OPTIONS } from '@/lib/types/demo';

import type { AppLocale } from '@/i18n/routing';

export type SessionRuntimeAccessRow = {
  session_id: string | null;
  group_id: string | null;
  status: string | null;
  leader_id: string | null;
  timer_mode: 'per_question' | 'global' | null;
  timer_seconds: number | null;
  question_goal: number | null;
  started_at: string | null;
  is_founder: boolean | null;
  member_count: number | null;
};

export type SessionAccessSnapshot = {
  id: string;
  group_id: string;
  status: string;
  leader_id: string | null;
  timer_mode: 'per_question' | 'global';
  timer_seconds: number;
  question_goal: number;
  started_at: string | null;
};

export function getGlobalDeadline(startedAt: string | null, timerSeconds: number) {
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : Date.now();
  return new Date(startedAtMs + timerSeconds * 1000);
}

export function isCustomAnswerLetter(value: string) {
  return /^[A-Z]$/.test(value);
}

export async function getCurrentAuthUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function loadSessionRuntimeAccess(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  sessionId: string,
  userId: string,
) {
  const { data: access } = await (supabase as unknown as {
    schema: (schemaName: string) => {
      from: (relation: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: SessionRuntimeAccessRow | null }>;
            };
          };
        };
      };
    };
  })
    .schema('public')
    .from('session_runtime_access')
    .select(
      'session_id, group_id, status, leader_id, timer_mode, timer_seconds, question_goal, started_at, is_founder, member_count',
    )
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  return access;
}

export function getSessionAccessSnapshot(access: SessionRuntimeAccessRow | null): SessionAccessSnapshot | null {
  if (
    !access?.session_id ||
    !access.group_id ||
    !access.status ||
    !access.timer_mode ||
    typeof access.timer_seconds !== 'number' ||
    typeof access.question_goal !== 'number'
  ) {
    return null;
  }

  return {
    id: access.session_id,
    group_id: access.group_id,
    status: access.status,
    leader_id: access.leader_id,
    timer_mode: access.timer_mode,
    timer_seconds: access.timer_seconds,
    question_goal: access.question_goal,
    started_at: access.started_at,
  };
}

export async function ensureQuestion(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  sessionId: string,
  orderIndex: number,
  userId: string,
  session: Pick<SessionAccessSnapshot, 'timer_mode' | 'timer_seconds' | 'started_at'>,
) {
  const now = new Date();
  const answerDeadlineAt =
    session.timer_mode === 'global'
      ? getGlobalDeadline(session.started_at ?? now.toISOString(), session.timer_seconds)
      : new Date(now.getTime() + session.timer_seconds * 1000);

  const { data: existing } = await supabase
    .schema('public')
    .from('questions')
    .select('id, answer_deadline_at')
    .eq('session_id', sessionId)
    .eq('order_index', orderIndex)
    .maybeSingle();

  if (existing) {
    if (!existing.answer_deadline_at) {
      await supabase
        .schema('public')
        .from('questions')
        .update({ answer_deadline_at: answerDeadlineAt.toISOString(), phase: 'answering' })
        .eq('id', existing.id);
    }

    return {
      id: existing.id,
      answerDeadlineAt: existing.answer_deadline_at ?? answerDeadlineAt.toISOString(),
    };
  }

  const { data: created, error } = await supabase
    .schema('public')
    .from('questions')
    .insert({
      session_id: sessionId,
      asked_by: userId,
      options: ANSWER_OPTIONS,
      order_index: orderIndex,
      phase: 'answering',
      launched_at: now.toISOString(),
      answer_deadline_at: answerDeadlineAt.toISOString(),
    })
    .select('id, answer_deadline_at')
    .single();

  if (error || !created) {
    throw new Error('question_create_failed');
  }

  return {
    id: created.id,
    answerDeadlineAt: created.answer_deadline_at ?? answerDeadlineAt.toISOString(),
  };
}

export async function resolveSessionQuestion(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  options: {
    sessionId: string;
    questionId?: string | null;
    questionIndex: number;
    userId: string;
    session: Pick<SessionAccessSnapshot, 'timer_mode' | 'timer_seconds' | 'started_at'>;
  },
) {
  const { sessionId, questionId, questionIndex, userId, session } = options;

  if (questionId) {
    const { data: existing } = await supabase
      .schema('public')
      .from('questions')
      .select('id, answer_deadline_at')
      .eq('id', questionId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing?.id) {
      return {
        id: existing.id,
        answerDeadlineAt: existing.answer_deadline_at,
      };
    }
  }

  return ensureQuestion(supabase, sessionId, questionIndex, userId, session);
}

export function getSessionRedirectPath(locale: AppLocale, sessionId: string, questionIndex?: number) {
  const path = `/${locale}/sessions/${sessionId}`;
  if (typeof questionIndex !== 'number') {
    return path;
  }

  return `${path}?q=${questionIndex}`;
}
