import { cache } from 'react';

import {
  DEFAULT_APP_POLICY_SETTINGS,
  type AppPolicySettings,
} from '@/lib/policy/defaults';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

const TEST_SESSION_TARGET = 3;

type BillingFields = Pick<
  Database['public']['Tables']['users']['Row'],
  'has_valid_payment_method' | 'subscription_status' | 'user_tier'
>;

export type PlanNextAccess = {
  completedTestSessions: number;
  requiredTestSessions: number;
  isPaid: boolean;
  isTestPhase: boolean;
  canInviteCandidates: boolean;
  lockedQuestionGoal: number;
  nextTestSessionNumber: number;
};

export function hasPaidAccess(user: BillingFields | null | undefined) {
  if (!user) {
    return false;
  }

  return (
    user.has_valid_payment_method ||
    user.subscription_status === 'active' ||
    user.subscription_status === 'trialing' ||
    user.user_tier === 'active'
  );
}

export const getPlanNextAccess = cache(
  async (
    userId: string,
    policy: Pick<AppPolicySettings, 'defaultQuestionGoal'> =
      DEFAULT_APP_POLICY_SETTINGS,
  ): Promise<PlanNextAccess> => {
    const supabase = createSupabaseServerClient();
    const [userResult, completedTestSessionCount] = await Promise.all([
      supabase
        .schema('public')
        .from('users')
        .select('has_valid_payment_method, subscription_status, user_tier')
        .eq('id', userId)
        .maybeSingle(),
      countCompletedTestSessions(userId),
    ]);

    const completedTestSessions = Math.min(
      completedTestSessionCount,
      TEST_SESSION_TARGET,
    );
    const isPaid = hasPaidAccess(userResult.data);
    const canInviteCandidates =
      isPaid && completedTestSessions >= TEST_SESSION_TARGET;

    return {
      completedTestSessions,
      requiredTestSessions: TEST_SESSION_TARGET,
      isPaid,
      isTestPhase: completedTestSessions < TEST_SESSION_TARGET,
      canInviteCandidates,
      lockedQuestionGoal: policy.defaultQuestionGoal,
      nextTestSessionNumber: Math.min(
        completedTestSessions + 1,
        TEST_SESSION_TARGET,
      ),
    };
  },
);

async function countCompletedTestSessions(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, groups!inner(group_kind)')
    .eq('user_id', userId)
    .eq('groups.group_kind', 'session_test');

  const groupIds =
    memberships
      ?.map((membership) => membership.group_id)
      .filter((groupId): groupId is string => Boolean(groupId)) ?? [];

  if (groupIds.length === 0) {
    return 0;
  }

  const { count } = await supabase
    .schema('public')
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .in('group_id', groupIds)
    .eq('status', 'completed');

  return count ?? 0;
}
