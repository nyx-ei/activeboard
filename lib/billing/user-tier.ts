import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export const USER_TIERS = {
  visitor: 'visitor',
  certifiedInactive: 'certified_inactive',
  certifiedActive: 'certified_active',
} as const;

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
  | 'has_valid_payment_method'
  | 'subscription_status'
  | 'subscription_current_period_ends_at'
  | 'stripe_customer_id'
  | 'stripe_default_payment_method_id'
  | 'billing_updated_at'
>;

export function deriveUserTier({
  hasValidPaymentMethod,
  subscriptionStatus,
}: {
  hasValidPaymentMethod: boolean;
  subscriptionStatus: SubscriptionStatus;
}): UserTier {
  if (!hasValidPaymentMethod) {
    return USER_TIERS.visitor;
  }

  if (subscriptionStatus === SUBSCRIPTION_STATUSES.active || subscriptionStatus === SUBSCRIPTION_STATUSES.trialing) {
    return USER_TIERS.certifiedActive;
  }

  return USER_TIERS.certifiedInactive;
}

export function getUserTierCapabilities(userTier: UserTier) {
  const isVisitor = userTier === USER_TIERS.visitor;
  const isCertifiedInactive = userTier === USER_TIERS.certifiedInactive;

  return {
    canBeCaptain: !isVisitor && !isCertifiedInactive ? true : false,
    canCreateSession: !isVisitor && !isCertifiedInactive ? true : false,
    canJoinMultipleGroups: !isVisitor,
    canDisplayHeatmap: !isVisitor,
    canShareHeatmap: !isVisitor,
    canBeDiscoverable: !isVisitor,
  };
}

export const getUserBillingSnapshot = cache(async (userId: string): Promise<BillingSnapshot | null> => {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .schema('public')
    .from('users')
    .select(
      'id, email, user_tier, has_valid_payment_method, subscription_status, subscription_current_period_ends_at, stripe_customer_id, stripe_default_payment_method_id, billing_updated_at',
    )
    .eq('id', userId)
    .maybeSingle();

  return data ?? null;
});
