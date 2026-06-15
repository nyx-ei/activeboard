import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import {
  DEFAULT_APP_POLICY_SETTINGS,
  type AppPolicySettings,
} from '@/lib/policy/defaults';

export const USER_TIERS = {
  trial: 'trial',
  locked: 'locked',
  active: 'active',
  dormant: 'dormant',
} as const;

export const TRIAL_QUESTION_LIMIT = 100;
export const TRIAL_WARNING_THRESHOLD = 85;

export const SUBSCRIPTION_STATUSES = {
  none: 'none',
  trialing: 'trialing',
  active: 'active',
  pastDue: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  incomplete: 'incomplete',
  incompleteExpired: 'incomplete_expired',
  paused: 'paused',
} as const;

export type UserTier = Database['public']['Tables']['users']['Row']['user_tier'];
export type SubscriptionStatus = Database['public']['Tables']['users']['Row']['subscription_status'];

type BillingSnapshot = Pick<
  Database['public']['Tables']['users']['Row'],
  | 'id'
  | 'email'
  | 'user_tier'
  | 'questions_answered'
  | 'has_valid_payment_method'
  | 'subscription_status'
  | 'subscription_current_period_ends_at'
  | 'stripe_customer_id'
  | 'stripe_default_payment_method_id'
  | 'billing_updated_at'
>;

export type TrialProgressSnapshot = {
  current: number;
  total: number;
  remaining: number;
  warningThreshold: number;
  showWarning: boolean;
  isComplete: boolean;
};

export function deriveUserTier({
  questionsAnswered,
  hasValidPaymentMethod,
  subscriptionStatus,
  policy = DEFAULT_APP_POLICY_SETTINGS,
}: {
  questionsAnswered: number;
  hasValidPaymentMethod: boolean;
  subscriptionStatus: SubscriptionStatus;
  policy?: Pick<AppPolicySettings, 'trialQuestionLimit'>;
}): UserTier {
  if (subscriptionStatus === SUBSCRIPTION_STATUSES.active || subscriptionStatus === SUBSCRIPTION_STATUSES.trialing) {
    return USER_TIERS.active;
  }

  if (questionsAnswered < policy.trialQuestionLimit) {
    return USER_TIERS.trial;
  }

  if (hasValidPaymentMethod) {
    return USER_TIERS.dormant;
  }

  return USER_TIERS.locked;
}

export function getUserTierCapabilities(userTier: UserTier) {
  const isTrial = userTier === USER_TIERS.trial;
  const isActive = userTier === USER_TIERS.active;
  const canRunCoreStudyFlows = isTrial || isActive;
  const canUseLookupLayer = isActive;

  return {
    canBeCaptain: canRunCoreStudyFlows,
    canCreateSession: canRunCoreStudyFlows,
    canJoinSessions: canRunCoreStudyFlows,
    canJoinMultipleGroups: canRunCoreStudyFlows,
    canDisplayHeatmap: true,
    canShareHeatmap: true,
    canBrowseLookupLayer: canUseLookupLayer,
    canBeDiscoverable: canUseLookupLayer,
    canViewLiveSessionLinelist: canUseLookupLayer,
    canSendLookupInvites: canUseLookupLayer,
  };
}

export function getTrialProgressSnapshot(
  questionsAnswered: number,
  policy: Pick<
    AppPolicySettings,
    'trialQuestionLimit' | 'trialWarningThreshold'
  > = DEFAULT_APP_POLICY_SETTINGS,
): TrialProgressSnapshot {
  return {
    current: Math.min(questionsAnswered, policy.trialQuestionLimit),
    total: policy.trialQuestionLimit,
    remaining: Math.max(policy.trialQuestionLimit - questionsAnswered, 0),
    warningThreshold: policy.trialWarningThreshold,
    showWarning:
      questionsAnswered >= policy.trialWarningThreshold &&
      questionsAnswered < policy.trialQuestionLimit,
    isComplete: questionsAnswered >= policy.trialQuestionLimit,
  };
}

export const getUserBillingSnapshot = cache(async (userId: string): Promise<BillingSnapshot | null> => {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .schema('public')
    .from('users')
    .select(
      'id, email, user_tier, questions_answered, has_valid_payment_method, subscription_status, subscription_current_period_ends_at, stripe_customer_id, stripe_default_payment_method_id, billing_updated_at',
    )
    .eq('id', userId)
    .maybeSingle();

  return data ?? null;
});
