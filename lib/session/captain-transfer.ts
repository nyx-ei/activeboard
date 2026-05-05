import 'server-only';

import type { createSupabaseServerClient } from '@/lib/supabase/server';

export type CaptainTransferResult = {
  ok: boolean | null;
  message_key: string | null;
  group_id: string | null;
  previous_leader_id: string | null;
  current_leader_id: string | null;
  state_changed: boolean | null;
};

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

export async function transferSessionCaptain(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    expectedLeaderId: string | null;
    targetUserId: string;
    allowedStatuses: string[];
  },
) {
  const { data, error } = await (
    supabase.schema('public') as unknown as {
      rpc: (
        fn: 'activeboard_transfer_session_captain',
        args: {
          target_session_id: string;
          expected_leader_id: string | null;
          target_user_id: string;
          allowed_statuses: string[];
        },
      ) => Promise<{
        data: CaptainTransferResult[] | null;
        error: { message?: string } | null;
      }>;
    }
  ).rpc('activeboard_transfer_session_captain', {
    target_session_id: input.sessionId,
    expected_leader_id: input.expectedLeaderId,
    target_user_id: input.targetUserId,
    allowed_statuses: input.allowedStatuses,
  });

  return { result: data?.[0] ?? null, error };
}
