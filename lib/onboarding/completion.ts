import 'server-only';

import { cache } from 'react';

import type { AppLocale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type OnboardingCompletion = {
  profileComplete: boolean;
  availabilityComplete: boolean;
  nextPath: string | null;
};

export function hasAvailabilitySlots(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value as Record<string, unknown>).some(
    (hours) => Array.isArray(hours) && hours.length > 0,
  );
}

export const getOnboardingCompletion = cache(
  async (
    userId: string,
    locale: AppLocale,
  ): Promise<OnboardingCompletion> => {
    const supabase = createSupabaseServerClient();
    const [profileResult, scheduleResult] = await Promise.all([
      supabase
        .schema('public')
        .from('users')
        .select('display_name, exam_session')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .schema('public')
        .from('user_schedules')
        .select('availability_grid')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const profileComplete = Boolean(
      profileResult.data?.display_name?.trim() &&
        profileResult.data?.exam_session,
    );
    const availabilityComplete = hasAvailabilitySlots(
      scheduleResult.data?.availability_grid,
    );
    const nextPath =
      profileComplete && availabilityComplete
        ? null
        : `/${locale}/profile?section=exam&onboarding=1`;

    return {
      profileComplete,
      availabilityComplete,
      nextPath,
    };
  },
);
