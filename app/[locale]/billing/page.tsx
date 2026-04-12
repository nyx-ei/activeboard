import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserBillingSnapshot, TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import { hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { getBillingPlans } from '@/lib/stripe/pricing';

type BillingPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

export default async function BillingPage({ params }: BillingPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Billing');
  const snapshot = await getUserBillingSnapshot(user.id);
  const billingEnabled = await isFeatureEnabled('canUseStripeBilling');
  const stripeConfigured = hasStripeEnv();
  const plans = stripeConfigured ? await getBillingPlans(locale) : [];

  if (!snapshot) {
    return null;
  }

  const questionProgress = Math.min(snapshot.questions_answered, TRIAL_QUESTION_LIMIT);
  const progressPercentage = Math.min(100, Math.round((questionProgress / TRIAL_QUESTION_LIMIT) * 100));
  const primaryPlan = plans.find((plan) => plan.highlight) ?? plans[0] ?? null;
  const monthlyPrice = primaryPlan?.amountLabel ?? '$15';
  const billingReady = Boolean(billingEnabled && stripeConfigured && primaryPlan);

  return (
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-black/74 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[480px]">
        <section className="rounded-[15px] border border-white/[0.06] bg-[#11192c] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-extrabold tracking-tight text-white">{t('title')}</h1>
            <Link href="/dashboard?view=performance" className="text-2xl leading-none text-slate-400 transition hover:text-white" aria-label={t('close')}>
              ×
            </Link>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-base font-semibold text-slate-300">{t('answersUsed')}</p>
              <p className="text-base font-extrabold text-white">
                {questionProgress} / {TRIAL_QUESTION_LIMIT}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#233049]">
              <div className="h-full rounded-full bg-brand" style={{ width: `${progressPercentage}%` }} />
            </div>
          </div>

          <div className="mt-6 rounded-[12px] border border-white/[0.06] bg-[#172237] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-extrabold text-white">{t('freePlanTitle')}</p>
                <ul className="mt-3 space-y-1.5 text-sm font-medium text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-slate-500">✓</span>
                    <span>{t('freePlanFeatureQuestions')}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-slate-500">✓</span>
                    <span>{t('freePlanFeatureNoCard')}</span>
                  </li>
                </ul>
              </div>
              <p className="text-2xl font-extrabold text-white">$0</p>
            </div>
          </div>

          <div className="mt-4 rounded-[12px] border border-white/[0.06] bg-[#172237] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-extrabold text-white">{t('unlimitedPlanTitle')}</p>
                <ul className="mt-3 space-y-1.5 text-sm font-semibold text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-brand">✓</span>
                    <span>{t('unlimitedFeatureAnswers')}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand">✓</span>
                    <span>{t('unlimitedFeatureGroups')}</span>
                  </li>
                </ul>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 line-through">{t('regularPrice')}</p>
                <p className="text-xl font-extrabold text-brand">
                  {monthlyPrice} <span className="text-sm font-semibold text-slate-400">/ {t('perMonth')}</span>
                </p>
              </div>
            </div>

            {!billingEnabled ? (
              <p className="mt-5 text-sm text-amber-300">{t('billingFlagDisabled')}</p>
            ) : !stripeConfigured ? (
              <p className="mt-5 text-sm text-amber-300">{t('billingConfigMissing')}</p>
            ) : billingReady ? (
              <button type="button" className="button-primary mt-4 w-full rounded-[7px] py-2.5 text-base" disabled>
                {t('upgradeToUnlimited')}
              </button>
            ) : (
              <p className="mt-5 text-sm text-amber-300">{t('subscriptionPlansMissing')}</p>
            )}

            <p className="mt-3 text-center text-xs font-semibold text-brand">{t('founderOffer')}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
