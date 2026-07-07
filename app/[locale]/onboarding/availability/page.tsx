import { redirect } from 'next/navigation';

import { TrialAvailabilityForm } from '@/components/onboarding/trial-onboarding-forms';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getOnboardingCompletion } from '@/lib/onboarding/completion';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type TrialAvailabilityPageProps = {
  params: { locale: string };
};

export default async function TrialAvailabilityPage({
  params,
}: TrialAvailabilityPageProps) {
  const locale = (params.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const user = await requireUser(locale);
  const onboarding = await getOnboardingCompletion(user.id, locale);

  if (!onboarding.profileComplete) {
    redirect(`/${locale}/onboarding/profile`);
  }

  if (!onboarding.nextPath) {
    redirect(`/${locale}/dashboard`);
  }

  const supabase = createSupabaseServerClient();
  const { data: schedule } = await supabase
    .schema('public')
    .from('user_schedules')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <TrialAvailabilityForm
      locale={locale}
      initialTimezone={schedule?.timezone ?? 'UTC'}
    />
  );
}

