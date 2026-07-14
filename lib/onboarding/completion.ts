import 'server-only';

import { cache } from 'react';

import type { AppLocale } from '@/i18n/routing';
import {
  getAvailabilitySlotCount,
  normalizeAvailabilityGrid,
} from '@/lib/schedule/availability';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type OnboardingCompletion = {
  profileComplete: boolean;
  availabilityComplete: boolean;
  nextPath: string | null;
};

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
        .select('display_name, phone_number, exam_type, exam_session')
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
        profileResult.data?.phone_number?.trim() &&
        profileResult.data?.exam_type &&
        profileResult.data?.exam_session,
    );
    const availabilityComplete =
      getAvailabilitySlotCount(
        normalizeAvailabilityGrid(scheduleResult.data?.availability_grid),
      ) >= 5;
    const nextPath =
      profileComplete && availabilityComplete
        ? null
        : profileComplete
          ? `/${locale}/onboarding/availability`
          : `/${locale}/onboarding/profile`;

    return {
      profileComplete,
      availabilityComplete,
      nextPath,
    };
  },
);
