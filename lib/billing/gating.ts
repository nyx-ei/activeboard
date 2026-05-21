import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { isFeatureEnabled } from '@/lib/features/flags';
import { deriveUserTier, getUserBillingSnapshot, getUserTierCapabilities } from '@/lib/billing/user-tier';
import { withFeedback } from '@/lib/utils';

export type UserTierCapability = keyof ReturnType<typeof getUserTierCapabilities>;

export const getUserAccessState = cache(async (userId: string) => {
  const [gatingEnabled, snapshot] = await Promise.all([
    isFeatureEnabled('canEnforceUserTierGating'),
    getUserBillingSnapshot(userId),
  ]);
  const effectiveUserTier = snapshot
    ? deriveUserTier({
        questionsAnswered: snapshot.questions_answered,
        hasValidPaymentMethod: snapshot.has_valid_payment_method,
        subscriptionStatus: snapshot.subscription_status,
      })
    : null;
  const capabilities = effectiveUserTier ? getUserTierCapabilities(effectiveUserTier) : null;

  return {
    gatingEnabled,
    snapshot,
    effectiveUserTier,
    capabilities,
  };
});

export function hasUserTierCapability(
  accessState: Awaited<ReturnType<typeof getUserAccessState>>,
  capability: UserTierCapability,
) {
  return Boolean(accessState.capabilities?.[capability]);
}

function getCapabilityFeedbackKey(capability: UserTierCapability) {
  switch (capability) {
    case 'canCreateSession':
      return 'upgradeRequiredToScheduleSession' as const;
    case 'canJoinMultipleGroups':
      return 'upgradeRequiredToJoinGroups' as const;
    case 'canBrowseLookupLayer':
      return 'upgradeRequiredToJoinGroups' as const;
    case 'canJoinSessions':
      return 'upgradeRequiredToJoinSession' as const;
    default:
      return 'upgradeRequiredGeneric' as const;
  }
}

export async function requireUserTierCapability({
  userId,
  capability,
  locale,
  redirectTo,
  feedbackKey,
}: {
  userId: string;
  capability: UserTierCapability;
  locale: AppLocale;
  redirectTo: string;
  feedbackKey?: string;
}) {
  const accessState = await getUserAccessState(userId);

  if (!hasUserTierCapability(accessState, capability)) {
    const t = await getTranslations({ locale, namespace: 'Feedback' });
    redirect(withFeedback(redirectTo, 'error', t(feedbackKey ?? getCapabilityFeedbackKey(capability))));
  }

  return accessState;
}
