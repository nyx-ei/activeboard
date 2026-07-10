import { redirect } from 'next/navigation';

import { TrialAccountForm } from '@/components/onboarding/trial-onboarding-forms';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getOnboardingCompletion } from '@/lib/onboarding/completion';

type TrialAccountPageProps = {
  params: { locale: string };
  searchParams?: { error?: string };
};

export default async function TrialAccountPage({
  params,
  searchParams,
}: TrialAccountPageProps) {
  const locale = (params.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const user = await getCurrentUser();

  if (user?.id) {
    const onboarding = await getOnboardingCompletion(user.id, locale);
    redirect(onboarding.nextPath ?? `/${locale}/dashboard`);
  }

  const initialError =
    searchParams?.error === 'email_mismatch' ||
    searchParams?.error === 'verification_failed'
      ? searchParams.error
      : undefined;

  return <TrialAccountForm locale={locale} initialError={initialError} />;
}
