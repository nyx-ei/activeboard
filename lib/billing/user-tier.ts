import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export const USER_TIERS = {
  trial: 'trial',
  locked: 'locked',
  active: 'active',
  dormant: 'dormant',
} as const;

export const TRIAL_QUESTION_LIMIT = 100;

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

export function deriveUserTier({
  questionsAnswered,
  hasValidPaymentMethod,
  subscriptionStatus,
}: {
  questionsAnswered: number;
  hasValidPaymentMethod: boolean;
  subscriptionStatus: SubscriptionStatus;
}): UserTier {
  if (questionsAnswered < TRIAL_QUESTION_LIMIT) {
    return USER_TIERS.trial;
  }

  if (subscriptionStatus === SUBSCRIPTION_STATUSES.active || subscriptionStatus === SUBSCRIPTION_STATUSES.trialing) {
    return USER_TIERS.active;
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
