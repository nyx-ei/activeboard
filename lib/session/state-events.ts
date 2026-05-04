import 'server-only';

import type { SessionSupabaseClient } from '@/lib/session/flow';

export type SessionStateEventType =
  | 'answer_submitted'
  | 'answer_timed_out'
  | 'question_advanced'
  | 'session_completed';

export async function recordSessionStateEvent(
  supabase: SessionSupabaseClient,
  input: {
    sessionId: string;
    groupId: string;
    questionId?: string | null;
    actorId: string;
    eventType: SessionStateEventType;
  },
) {
  await supabase
    .schema('public')
    .from('session_state_events')
    .insert({
      session_id: input.sessionId,
      group_id: input.groupId,
      question_id: input.questionId ?? null,
      actor_id: input.actorId,
      event_type: input.eventType,
    });
}
