import 'server-only';

import type { AppPolicySettings } from '@/lib/policy/defaults';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { generateInviteCode } from '@/lib/utils';

const TEST_SESSION_TARGET = 3;
const TEST_SESSION_SPACING_DAYS = 2;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id'
>;

export async function ensureInitialTestSessions(
  user: UserRow,
  policy: Pick<
    AppPolicySettings,
    'defaultQuestionGoal' | 'perQuestionTimerDefaultSeconds'
  >,
) {
  const admin = createSupabaseAdminClient();
  const existingCount = await countExistingTestWindowSessions(admin, user.id);
  const missingCount = TEST_SESSION_TARGET - existingCount;

  if (missingCount <= 0) {
    return;
  }

  const groupId = await getOrCreateTestGroup(admin, user);
  const now = new Date();
  const sessions = Array.from({ length: missingCount }, (_, index) => {
    const sessionNumber = existingCount + index + 1;
    return {
      group_id: groupId,
      name: `Session test ${sessionNumber}`,
      scheduled_at: getDefaultTestSessionDate(now, sessionNumber).toISOString(),
      timer_mode: 'per_question' as const,
      timer_seconds: policy.perQuestionTimerDefaultSeconds,
      question_goal: policy.defaultQuestionGoal,
      created_by: user.id,
      leader_id: user.id,
      status: 'scheduled' as const,
    };
  });

  await admin.schema('public').from('sessions').insert(sessions);
}

async function countExistingTestWindowSessions(
  admin: AdminClient,
  userId: string,
) {
  const { count } = await (
    admin as AdminClient & {
      schema: (schemaName: 'public') => {
        from: (relation: 'dashboard_user_sessions') => {
          select: (
            columns: string,
            options: { count: 'exact'; head: true },
          ) => {
            eq: (
              column: 'user_id',
              value: string,
            ) => {
              neq: (
                column: 'status',
                value: string,
              ) => Promise<{ count: number | null }>;
            };
          };
        };
      };
    }
  )
    .schema('public')
    .from('dashboard_user_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'cancelled');

  return Math.min(count ?? 0, TEST_SESSION_TARGET);
}

async function getOrCreateTestGroup(admin: AdminClient, user: UserRow) {
  const { data: existingTestMembership } = await admin
    .schema('public')
    .from('group_members')
    .select('group_id, groups!inner(id, group_kind)')
    .eq('user_id', user.id)
    .eq('groups.group_kind', 'session_test')
    .limit(1)
    .maybeSingle();

  if (existingTestMembership?.group_id) {
    return existingTestMembership.group_id;
  }

  const { data: existingMembership } = await admin
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership?.group_id) {
    return existingMembership.group_id;
  }

  const inviteCode = await createUniqueInviteCode(admin);
  const fallbackName = getFallbackTestGroupName(user);
  const { data: createdGroup } = await admin
    .schema('public')
    .from('groups')
    .insert({
      name: fallbackName,
      invite_code: inviteCode,
      created_by: user.id,
      difficulty_level: 'medium',
      group_kind: 'session_test',
      max_members: 5,
    })
    .select('id')
    .single();

  if (!createdGroup?.id) {
    throw new Error('Unable to create initial test group');
  }

  await admin.schema('public').from('group_members').upsert(
    {
      group_id: createdGroup.id,
      user_id: user.id,
      is_founder: true,
    },
    { onConflict: 'group_id,user_id' },
  );

  return createdGroup.id;
}

async function createUniqueInviteCode(admin: AdminClient) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode();
    const { data } = await admin
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return generateInviteCode();
}

function getDefaultTestSessionDate(now: Date, sessionNumber: number) {
  const date = new Date(now);
  date.setDate(now.getDate() + 1 + (sessionNumber - 1) * TEST_SESSION_SPACING_DAYS);
  date.setHours(18, 0, 0, 0);
  return date;
}

function getFallbackTestGroupName(user: UserRow) {
  return `${user.id.slice(0, 8)} - test`;
}
