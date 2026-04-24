import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const FEATURE_FLAGS = {
  canUseUbiquitousLogging: false,
  canUsePerformanceLogging: true,
  canUseStripeBilling: false,
  canEnforceUserTierGating: true,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

function getFeatureFlagDefault(key: FeatureFlagKey) {
  return FEATURE_FLAGS[key];
}

const readFeatureFlag = cache(async (key: FeatureFlagKey): Promise<boolean> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .schema('public')
    .from('feature_flags')
    .select('enabled')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) {
    return getFeatureFlagDefault(key);
  }

  return data.enabled;
});

export async function isFeatureEnabled(key: FeatureFlagKey) {
  return readFeatureFlag(key);
}

export async function getFeatureFlags() {
  const entries = await Promise.all(
    (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map(async (key) => [key, await readFeatureFlag(key)] as const),
  );

  return Object.fromEntries(entries) as Record<FeatureFlagKey, boolean>;
}
