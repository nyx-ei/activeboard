import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { getUserBillingSnapshot, getUserTierCapabilities, TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import { getBillingPlans } from '@/lib/stripe/pricing';

import {
  createBillingPortalSessionAction,
  createBillingSetupSessionAction,
  createSubscriptionCheckoutAction,
} from './actions';

type BillingPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
      {children}
    </span>
  );
}

function CapabilityRow({
  label,
  statusLabel,
  unlocked,
}: {
  label: string;
  statusLabel: string;
  unlocked: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3">
      <p className="min-w-0 text-sm font-medium text-white">{label}</p>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          unlocked ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'
        }`}
      >
        {statusLabel}
      </span>
    </li>
  );
}

function getTierLabel(
  userTier: 'trial' | 'locked' | 'active' | 'dormant',
  t: (key: 'tier.trial' | 'tier.locked' | 'tier.active' | 'tier.dormant') => string,
) {
  if (userTier === 'active') return t('tier.active');
  if (userTier === 'dormant') return t('tier.dormant');
  if (userTier === 'locked') return t('tier.locked');
  return t('tier.trial');
}

function getSubscriptionLabel(
  status:
    | 'none'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused',
  t: (
    key:
      | 'subscription.none'
      | 'subscription.trialing'
      | 'subscription.active'
      | 'subscription.past_due'
      | 'subscription.canceled'
      | 'subscription.unpaid'
      | 'subscription.incomplete'
      | 'subscription.incomplete_expired'
      | 'subscription.paused',
  ) => string,
) {
  switch (status) {
    case 'trialing':
      return t('subscription.trialing');
    case 'active':
      return t('subscription.active');
    case 'past_due':
      return t('subscription.past_due');
    case 'canceled':
      return t('subscription.canceled');
    case 'unpaid':
      return t('subscription.unpaid');
    case 'incomplete':
      return t('subscription.incomplete');
    case 'incomplete_expired':
      return t('subscription.incomplete_expired');
    case 'paused':
      return t('subscription.paused');
    default:
      return t('subscription.none');
  }
}

export default async function BillingPage({ params, searchParams }: BillingPageProps) {
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

  const capabilities = getUserTierCapabilities(snapshot.user_tier);
  const questionProgress = Math.min(snapshot.questions_answered, TRIAL_QUESTION_LIMIT);
  const remainingTrialQuestions = Math.max(TRIAL_QUESTION_LIMIT - snapshot.questions_answered, 0);

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col gap-6">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/dashboard" className="button-ghost -ml-4 px-4">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M15 6l-6 6l6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              {t('backToDashboard')}
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">{t('description')}</p>
            <p className="mt-3 text-sm font-medium text-slate-500">
              {t('trialProgress', {
                current: questionProgress,
                total: TRIAL_QUESTION_LIMIT,
                remaining: remainingTrialQuestions,
              })}
            </p>
          </div>
          <StatusBadge>{getTierLabel(snapshot.user_tier, t)}</StatusBadge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface p-5">
          <p className="text-sm font-medium text-slate-400">{t('paymentMethodTitle')}</p>
          <p className="mt-3 text-lg font-bold text-white">
            {snapshot.has_valid_payment_method ? t('paymentMethodPresent') : t('paymentMethodMissing')}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {snapshot.stripe_default_payment_method_id
              ? t('paymentMethodId', { id: snapshot.stripe_default_payment_method_id })
              : t('paymentMethodHint')}
          </p>
        </article>

        <article className="surface p-5">
          <p className="text-sm font-medium text-slate-400">{t('subscriptionTitle')}</p>
          <p className="mt-3 text-lg font-bold text-white">
            {getSubscriptionLabel(snapshot.subscription_status, t)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {snapshot.subscription_current_period_ends_at
              ? t('subscriptionEndsAt', {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(snapshot.subscription_current_period_ends_at),
                  ),
                })
              : t('subscriptionHint')}
          </p>
        </article>

        <article className="surface p-5">
          <p className="text-sm font-medium text-slate-400">{t('capabilitiesTitle')}</p>
          <p className="mt-2 text-sm text-slate-500">{t('capabilitiesDescription')}</p>
          <ul className="mt-4 space-y-2">
            <CapabilityRow
              label={t('capabilities.beCaptain')}
              statusLabel={capabilities.canBeCaptain ? t('capabilityAvailable') : t('capabilityLockedShort')}
              unlocked={capabilities.canBeCaptain}
            />
            <CapabilityRow
              label={t('capabilities.joinMultipleGroups')}
              statusLabel={capabilities.canJoinMultipleGroups ? t('capabilityAvailable') : t('capabilityLockedShort')}
              unlocked={capabilities.canJoinMultipleGroups}
            />
            <CapabilityRow
              label={t('capabilities.displayHeatmap')}
              statusLabel={capabilities.canDisplayHeatmap ? t('capabilityAvailable') : t('capabilityLockedShort')}
              unlocked={capabilities.canDisplayHeatmap}
            />
            <CapabilityRow
              label={t('capabilities.beDiscoverable')}
              statusLabel={capabilities.canBeDiscoverable ? t('capabilityAvailable') : t('capabilityLockedShort')}
              unlocked={capabilities.canBeDiscoverable}
            />
          </ul>
        </article>
      </section>

      <section className="surface p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white">{t('cardAssociationTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{t('cardAssociationDescription')}</p>

        {!billingEnabled ? (
          <p className="mt-5 text-sm text-amber-300">{t('billingFlagDisabled')}</p>
        ) : !stripeConfigured ? (
          <p className="mt-5 text-sm text-amber-300">{t('billingConfigMissing')}</p>
        ) : snapshot.has_valid_payment_method ? (
          <div className="mt-5 rounded-[18px] border border-brand/20 bg-brand/10 px-4 py-4 text-sm text-brand">
            {snapshot.user_tier === 'trial' ? t('cardAssociatedDuringTrial') : t('cardAssociationComplete')}
          </div>
        ) : (
          <form action={createBillingSetupSessionAction} className="mt-5">
            <input type="hidden" name="locale" value={locale} />
            <SubmitButton pendingLabel={t('addCardPending')} className="button-primary min-w-[220px]">
              {t('addCard')}
            </SubmitButton>
          </form>
        )}
      </section>

      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{t('plansTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">{t('plansDescription')}</p>
          </div>

          {snapshot.stripe_customer_id ? (
            <form action={createBillingPortalSessionAction}>
              <input type="hidden" name="locale" value={locale} />
              <SubmitButton pendingLabel={t('manageSubscriptionPending')} className="button-secondary min-w-[220px]">
                {t('manageSubscription')}
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {!billingEnabled ? (
          <p className="mt-5 text-sm text-amber-300">{t('billingFlagDisabled')}</p>
        ) : !stripeConfigured ? (
          <p className="mt-5 text-sm text-amber-300">{t('billingConfigMissing')}</p>
        ) : plans.length === 0 ? (
          <p className="mt-5 text-sm text-amber-300">{t('subscriptionPlansMissing')}</p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => {
              const disabled = !snapshot.has_valid_payment_method;
              return (
                <article
                  key={plan.key}
                  className={`rounded-[24px] border p-5 ${
                    plan.highlight ? 'border-brand/40 bg-brand/10' : 'border-white/8 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                        {plan.cadence === 'year' ? t('yearlyPlanLabel') : t('monthlyPlanLabel')}
                      </p>
                      <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                        {plan.amountLabel}
                        <span className="ml-1 text-base font-medium text-slate-400">
                          /{plan.cadence === 'year' ? t('perYear') : t('perMonth')}
                        </span>
                      </p>
                    </div>

                    {plan.highlight ? <StatusBadge>{t('bestValue')}</StatusBadge> : null}
                  </div>

                  <ul className="mt-5 space-y-2 text-sm text-slate-300">
                    <li>{t('planFeatureCaptain')}</li>
                    <li>{t('planFeatureHeatmap')}</li>
                    <li>{t('planFeatureDiscoverable')}</li>
                  </ul>

                  {disabled ? (
                    <p className="mt-5 text-sm text-amber-300">{t('subscriptionRequiresCard')}</p>
                  ) : (
                    <form action={createSubscriptionCheckoutAction} className="mt-5">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="planKey" value={plan.key} />
                      <SubmitButton
                        pendingLabel={t('startSubscriptionPending')}
                        className={`w-full ${plan.highlight ? 'button-primary' : 'button-secondary'}`}
                      >
                        {t('startSubscription')}
                      </SubmitButton>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
