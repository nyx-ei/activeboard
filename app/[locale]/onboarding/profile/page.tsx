import { redirect } from 'next/navigation';

import { TrialProfileForm } from '@/components/onboarding/trial-onboarding-forms';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getOnboardingCompletion } from '@/lib/onboarding/completion';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type TrialProfilePageProps = {
  params: { locale: string };
};

export default async function TrialProfilePage({
  params,
}: TrialProfilePageProps) {
  const locale = (params.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const user = await requireUser(locale);
  const onboarding = await getOnboardingCompletion(user.id, locale);

  if (onboarding.profileComplete && onboarding.nextPath) {
    redirect(onboarding.nextPath);
  }

  if (!onboarding.nextPath) {
    redirect(`/${locale}/dashboard`);
  }

  const supabase = createSupabaseServerClient();
  const [profileResult, scheduleResult] = await Promise.all([
    supabase
      .schema('public')
      .from('users')
      .select('phone_number, exam_type, exam_session, question_banks')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('user_schedules')
      .select('timezone')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return (
    <TrialProfileForm
      locale={locale}
      initialPhoneNumber={profileResult.data?.phone_number ?? ''}
      initialExamType={profileResult.data?.exam_type ?? 'mccqe_en'}
      initialExamSession={profileResult.data?.exam_session ?? 'planning_ahead'}
      initialQbanks={profileResult.data?.question_banks ?? []}
      initialTimezone={scheduleResult.data?.timezone ?? 'UTC'}
    />
  );
}
