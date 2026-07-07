import { redirect } from 'next/navigation';

import { TrialAccountForm } from '@/components/onboarding/trial-onboarding-forms';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getOnboardingCompletion } from '@/lib/onboarding/completion';

type TrialAccountPageProps = {
  params: { locale: string };
};

export default async function TrialAccountPage({
  params,
}: TrialAccountPageProps) {
  const locale = (params.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const user = await getCurrentUser();

  if (user?.id) {
    const onboarding = await getOnboardingCompletion(user.id, locale);
    redirect(onboarding.nextPath ?? `/${locale}/dashboard`);
  }

  return <TrialAccountForm locale={locale} />;
}

