import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { getUserBillingSnapshot, getUserTierCapabilities, USER_TIERS } from '@/lib/billing/user-tier';

import { createBillingSetupSessionAction } from './actions';

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

function getTierLabel(
  userTier: 'visitor' | 'certified_inactive' | 'certified_active',
  t: (key: 'tier.visitor' | 'tier.certified_inactive' | 'tier.certified_active') => string,
) {
  if (userTier === 'certified_active') return t('tier.certified_active');
  if (userTier === 'certified_inactive') return t('tier.certified_inactive');
  return t('tier.visitor');
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

  if (!snapshot) {
    return null;
  }

  const capabilities = getUserTierCapabilities(snapshot.user_tier);
  const isVisitor = snapshot.user_tier === USER_TIERS.visitor;

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
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>{capabilities.canJoinMultipleGroups ? t('capabilityUnlocked') : t('capabilityLocked', { capability: t('capabilities.joinMultipleGroups') })}</li>
            <li>{capabilities.canDisplayHeatmap ? t('capabilityUnlocked') : t('capabilityLocked', { capability: t('capabilities.displayHeatmap') })}</li>
            <li>{capabilities.canBeDiscoverable ? t('capabilityUnlocked') : t('capabilityLocked', { capability: t('capabilities.beDiscoverable') })}</li>
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
            {isVisitor ? t('cardAssociatedButAwaitingSync') : t('cardAssociationComplete')}
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
    </main>
  );
}
