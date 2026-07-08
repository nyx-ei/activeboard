import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserBillingSnapshot } from '@/lib/billing/user-tier';
import { hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { getBillingPlans } from '@/lib/stripe/pricing';
import { getUnlimitedPaymentLink } from '@/lib/stripe/payment-links';

import { createBillingPortalSessionAction } from './actions';

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
  const [snapshot, billingEnabled] = await Promise.all([
    getUserBillingSnapshot(user.id),
    isFeatureEnabled('canUseStripeBilling'),
  ]);
  const stripeConfigured = hasStripeEnv();
  const plans = stripeConfigured ? await getBillingPlans(locale) : [];

  if (!snapshot) {
    return null;
  }

  const primaryPlan = plans.find((plan) => plan.highlight) ?? plans[0] ?? null;
  const monthlyPrice = locale === 'fr' ? '15$' : '$15';
  const billingReady = Boolean(billingEnabled && stripeConfigured && primaryPlan);
  const hasActiveUnlimited =
    snapshot.user_tier === 'active' ||
    snapshot.subscription_status === 'active' ||
    snapshot.subscription_status === 'trialing';
  const paymentLink = getUnlimitedPaymentLink(snapshot.email ?? user.email ?? null);

  return (
    <main className="fixed inset-0 z-50 flex h-dvh min-h-dvh items-end justify-center overflow-y-auto overscroll-none bg-black/74 px-0 py-0 backdrop-blur-[2px] sm:px-4 sm:py-6">
      <div className="w-full max-w-[420px] animate-in slide-in-from-bottom-4 duration-200 sm:max-w-[460px]">
        <section className="rounded-t-[16px] border border-white/[0.06] bg-[#11192c] p-5 shadow-[0_-24px_70px_rgba(0,0,0,0.55)] sm:rounded-[15px] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-lg font-extrabold tracking-tight text-white">{t('title')}</h1>
            <Link href="/dashboard" className="text-2xl leading-none text-slate-400 transition hover:text-white" aria-label={t('close')}>
              x
            </Link>
          </div>

          <div className="mt-5 rounded-[10px] border border-white/[0.06] bg-[#172237] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-white">{t('freePlanTitle')}</p>
                <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-slate-500">+</span>
                    <span>{t('freePlanFeatureQuestions')}</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-center gap-2">
                {!hasActiveUnlimited ? (
                  <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-extrabold text-slate-300">{t('currentPlan')}</span>
                ) : null}
                <p className="text-xl font-extrabold text-white">$0</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[10px] border border-white/[0.06] bg-[#172237] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-white">{t('unlimitedPlanTitle')}</p>
                <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-brand">+</span>
                    <span>{t('unlimitedFeatureAnswers')}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand">+</span>
                    <span>{t('unlimitedFeatureGroups')}</span>
                  </li>
                </ul>
              </div>
              <div className="text-right">
                {hasActiveUnlimited ? (
                  <span className="inline-flex rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                    {t('currentPlan')}
                  </span>
                ) : null}
                <p className="text-lg font-extrabold text-brand">
                  <span className="mr-2 text-sm font-semibold text-slate-500 line-through">
                    {t('regularPrice')}
                  </span>
                  {monthlyPrice} <span className="text-sm font-semibold text-slate-400">/ {t('perMonth')}</span>
                </p>
              </div>
            </div>

            {hasActiveUnlimited ? (
              <form action={createBillingPortalSessionAction} className="mt-4">
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="h-9 w-full rounded-[7px] border border-brand/40 bg-brand/10 text-sm font-extrabold text-brand transition hover:bg-brand/15"
                >
                  {t('manageSubscription')}
                </button>
              </form>
            ) : (
              <a
                href={paymentLink}
                className="mt-4 flex h-9 w-full items-center justify-center rounded-[7px] bg-brand text-sm font-extrabold text-background transition hover:opacity-90"
              >
                {t('upgradeToUnlimited')}
              </a>
            )}

            <p className="mt-3 text-center text-xs font-semibold text-slate-500">
              {hasActiveUnlimited ? t('unlimitedActiveHint') : t('unlimitedCheckoutHint')}
            </p>
            {!billingEnabled || !stripeConfigured || !billingReady ? <p className="sr-only">{t('subscriptionPlansMissing')}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
