import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';
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

type SessionSupabaseClient =
  | ReturnType<typeof createSupabaseServerClient>
  | ReturnType<typeof createSupabaseAdminClient>;

export function getGlobalDeadline(
  startedAt: string | null,
  timerSeconds: number,
) {
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : Date.now();
  return new Date(startedAtMs + timerSeconds * 1000);
}

export function isCustomAnswerLetter(value: string) {
  return /^[A-Z]$/.test(value);
}

export async function getCurrentAuthUser() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (!error && subject) {
    return {
      supabase,
      user: {
        id: subject,
        email:
          typeof data.claims.email === 'string' ? data.claims.email : undefined,
      },
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function getCurrentAuthClaimsUser() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (error || !subject) {
    return { supabase, user: null };
  }

  return {
    supabase,
    user: {
      id: subject,
      email:
        typeof data.claims.email === 'string' ? data.claims.email : undefined,
    },
  };
}

export async function loadSessionRuntimeAccess(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  sessionId: string,
  userId: string,
  includeMemberCount = true,
) {
  const { data: access } = await (
    supabase as typeof supabase & {
      schema: (schemaName: 'public') => {
        from: (relation: 'session_runtime_access') => {
          select: (columns: string) => {
            eq: (
              column: 'session_id',
              value: string,
            ) => {
              eq: (
                column: 'user_id',
                value: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: SessionRuntimeAccessRow | null;
                }>;
              };
            };
          };
        };
      };
    }
  )
    .schema('public')
    .from('session_runtime_access')
    .select(
      includeMemberCount
        ? 'session_id, group_id, status, leader_id, timer_mode, timer_seconds, question_goal, started_at, is_founder, member_count'
        : 'session_id, group_id, status, leader_id, timer_mode, timer_seconds, question_goal, started_at, is_founder',
    )
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!access) {
    return null;
  }

  return {
    ...access,
    member_count: includeMemberCount ? (access?.member_count ?? 0) : 0,
  } satisfies SessionRuntimeAccessRow;
}

export function getSessionAccessSnapshot(
  access: SessionRuntimeAccessRow | null,
): SessionAccessSnapshot | null {
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
  supabase: SessionSupabaseClient,
  sessionId: string,
  orderIndex: number,
  userId: string,
  session: Pick<
    SessionAccessSnapshot,
    'timer_mode' | 'timer_seconds' | 'started_at'
  >,
) {
  const now = new Date();
  const answerDeadlineAt =
    session.timer_mode === 'global'
      ? getGlobalDeadline(
          session.started_at ?? now.toISOString(),
          session.timer_seconds,
        )
      : new Date(now.getTime() + session.timer_seconds * 1000);

  const { data: activatedDraft } = await supabase
    .schema('public')
    .from('questions')
    .update({
      answer_deadline_at: answerDeadlineAt.toISOString(),
      launched_at: now.toISOString(),
      phase: 'answering',
    })
    .eq('session_id', sessionId)
    .eq('order_index', orderIndex)
    .is('answer_deadline_at', null)
    .select('id, answer_deadline_at')
    .maybeSingle();

  if (activatedDraft?.id) {
    return {
      id: activatedDraft.id,
      answerDeadlineAt:
        activatedDraft.answer_deadline_at ?? answerDeadlineAt.toISOString(),
    };
  }

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
        .update({
          answer_deadline_at: answerDeadlineAt.toISOString(),
          launched_at: now.toISOString(),
          phase: 'answering',
        })
        .eq('id', existing.id);
    }

    return {
      id: existing.id,
      answerDeadlineAt:
        existing.answer_deadline_at ?? answerDeadlineAt.toISOString(),
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
    answerDeadlineAt:
      created.answer_deadline_at ?? answerDeadlineAt.toISOString(),
  };
}

export async function createInitialQuestionFast(
  supabase: SessionSupabaseClient,
  sessionId: string,
  userId: string,
  session: Pick<
    SessionAccessSnapshot,
    'timer_mode' | 'timer_seconds' | 'started_at'
  >,
) {
  const now = new Date();
  const answerDeadlineAt =
    session.timer_mode === 'global'
      ? getGlobalDeadline(
          session.started_at ?? now.toISOString(),
          session.timer_seconds,
        )
      : new Date(now.getTime() + session.timer_seconds * 1000);

  const { data: created, error } = await supabase
    .schema('public')
    .from('questions')
    .insert({
      session_id: sessionId,
      asked_by: userId,
      options: ANSWER_OPTIONS,
      order_index: 0,
      phase: 'answering',
      launched_at: now.toISOString(),
      answer_deadline_at: answerDeadlineAt.toISOString(),
    })
    .select('id, answer_deadline_at')
    .maybeSingle();

  if (created?.id) {
    return {
      id: created.id,
      answerDeadlineAt:
        created.answer_deadline_at ?? answerDeadlineAt.toISOString(),
    };
  }

  if (error?.code !== '23505') {
    throw new Error('question_create_failed');
  }

  return ensureQuestion(supabase, sessionId, 0, userId, session);
}

export async function precreateQuestionShell(
  supabase: SessionSupabaseClient,
  sessionId: string,
  orderIndex: number,
  userId: string,
) {
  const { data: existing } = await supabase
    .schema('public')
    .from('questions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('order_index', orderIndex)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: created } = await supabase
    .schema('public')
    .from('questions')
    .insert({
      session_id: sessionId,
      asked_by: userId,
      options: ANSWER_OPTIONS,
      order_index: orderIndex,
      phase: 'draft',
    })
    .select('id')
    .maybeSingle();

  return created?.id ?? null;
}

export async function resolveSessionQuestion(
  supabase: SessionSupabaseClient,
  options: {
    sessionId: string;
    questionId?: string | null;
    questionIndex: number;
    userId: string;
    session: Pick<
      SessionAccessSnapshot,
      'timer_mode' | 'timer_seconds' | 'started_at'
    >;
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

export function getSessionRedirectPath(
  locale: AppLocale,
  sessionId: string,
  questionIndex?: number,
) {
  const path = `/${locale}/sessions/${sessionId}`;
  if (typeof questionIndex !== 'number') {
    return path;
  }

  return `${path}?q=${questionIndex}`;
}
