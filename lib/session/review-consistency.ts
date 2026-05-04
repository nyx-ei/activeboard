import 'server-only';

import type { Json } from '@/lib/supabase/types';
import type { createSupabaseServerClient } from '@/lib/supabase/server';

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

export type ReviewSnapshotQuestion = {
  id: string;
  body: string | null;
  options: Json;
  order_index: number;
  phase: string | null;
  launched_at: string | null;
  answer_deadline_at: string | null;
  correct_option?: string | null;
  review_version?: number;
};

export type ReviewSnapshotAnswer = {
  id: string;
  question_id: string;
  user_id: string;
  selected_option: string | null;
  confidence: string | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

type ReviewSnapshotRow = {
  question: Json;
  answers: Json;
  reviewed_question_count: number | null;
  review_version: number | null;
};

type SaveReviewSnapshotRow = {
  question_id: string;
  review_version: number | null;
  answer_count: number | null;
};

export async function getReviewQuestionSnapshot(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    questionIndex: number;
  },
) {
  const { data, error } = await (
    supabase.schema('public') as unknown as {
      rpc: (
        fn: 'activeboard_get_review_question_snapshot',
        args: {
          target_session_id: string;
          target_question_index: number;
        },
      ) => Promise<{
        data: ReviewSnapshotRow[] | null;
        error: { message?: string } | null;
      }>;
    }
  ).rpc('activeboard_get_review_question_snapshot', {
    target_session_id: input.sessionId,
    target_question_index: input.questionIndex,
  });

  const row = data?.[0] ?? null;
  return {
    error,
    snapshot: row
      ? {
          question: row.question as ReviewSnapshotQuestion,
          answers: Array.isArray(row.answers)
            ? (row.answers as ReviewSnapshotAnswer[])
            : [],
          reviewedQuestionCount: row.reviewed_question_count ?? 0,
          reviewVersion: row.review_version ?? 0,
        }
      : null,
  };
}

export async function saveReviewSnapshot(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    questionId: string;
    correctOption: string;
  },
) {
  const { data, error } = await (
    supabase.schema('public') as unknown as {
      rpc: (
        fn: 'activeboard_save_review_snapshot',
        args: {
          target_session_id: string;
          target_question_id: string;
          correct_option_input: string;
        },
      ) => Promise<{
        data: SaveReviewSnapshotRow[] | null;
        error: { message?: string } | null;
      }>;
    }
  ).rpc('activeboard_save_review_snapshot', {
    target_session_id: input.sessionId,
    target_question_id: input.questionId,
    correct_option_input: input.correctOption,
  });

  return { error, result: data?.[0] ?? null };
}
