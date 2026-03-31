'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type Stripe from 'stripe';

import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getAppUrl, hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { ensureStripeCustomer } from '@/lib/stripe/customer';
import { getBillingPlanByKey } from '@/lib/stripe/pricing';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withFeedback } from '@/lib/utils';

const PRIMARY_BILLING_CURRENCY = 'cad' as const;
const BILLING_CURRENCY_FALLBACK = 'eur' as const;

async function requireBillingContext(locale: AppLocale) {
  const t = await getTranslations({ locale, namespace: 'Billing' });
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const isBillingEnabled = await isFeatureEnabled('canUseStripeBilling');
  if (!isBillingEnabled || !hasStripeEnv()) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')));
  }

  const supabase = createSupabaseServerClient();
  const { data: billingSnapshot } = await supabase
    .schema('public')
    .from('users')
    .select(
      'email, stripe_customer_id, has_valid_payment_method, user_tier, subscription_status, subscription_current_period_ends_at',
    )
    .eq('id', user.id)
    .single();

  if (!billingSnapshot) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')));
  }

  return {
    t,
    user,
    billingSnapshot,
  };
}

export async function createBillingSetupSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const { t, user, billingSnapshot } = await requireBillingContext(locale);

  const customerId = await ensureStripeCustomer(user, billingSnapshot);
  const stripe = createStripeServerClient();
  const appUrl = getAppUrl();

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      currency: PRIMARY_BILLING_CURRENCY,
      payment_method_types: ['card'],
      success_url: `${appUrl}/${locale}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${locale}/billing`,
      metadata: {
        userId: user.id,
        locale,
      },
    });
  } catch {
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'setup',
        customer: customerId,
        currency: BILLING_CURRENCY_FALLBACK,
        payment_method_types: ['card'],
        success_url: `${appUrl}/${locale}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${locale}/billing`,
        metadata: {
          userId: user.id,
          locale,
          currencyFallback: 'true',
        },
      });
    } catch {
      redirect(withFeedback(`/${locale}/billing`, 'error', t('checkoutInitializationFailed')));
    }
  }

  await logAppEvent({
    eventName: APP_EVENTS.billingSetupStarted,
    locale,
    userId: user.id,
    metadata: {
      stripe_customer_id: customerId,
      current_user_tier: billingSnapshot.user_tier,
      already_has_payment_method: billingSnapshot.has_valid_payment_method,
    },
  });

  if (!session.url) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')));
  }

  redirect(session.url);
}

export async function createSubscriptionCheckoutAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const planKey = formData.get('planKey')?.toString() ?? null;
  const { t, user, billingSnapshot } = await requireBillingContext(locale);

  if (!billingSnapshot.has_valid_payment_method) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('subscriptionRequiresCard')));
  }

  const plan = await getBillingPlanByKey(planKey, locale);
  if (!plan) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('subscriptionPlanUnavailable')));
  }

  const customerId = await ensureStripeCustomer(user, billingSnapshot);
  const stripe = createStripeServerClient();
  const appUrl = getAppUrl();

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/${locale}/billing/subscription/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${locale}/billing`,
      metadata: {
        userId: user.id,
        locale,
        planKey: plan.key,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          locale,
          planKey: plan.key,
        },
      },
    });
  } catch {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('subscriptionCheckoutInitializationFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.subscriptionCheckoutStarted,
    locale,
    userId: user.id,
    metadata: {
      stripe_customer_id: customerId,
      plan_key: plan.key,
      price_id: plan.stripePriceId,
      previous_subscription_status: billingSnapshot.subscription_status,
    },
  });

  if (!session.url) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')));
  }

  redirect(session.url);
}

export async function createBillingPortalSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const { t, user, billingSnapshot } = await requireBillingContext(locale);

  if (!billingSnapshot.stripe_customer_id) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingPortalUnavailable')));
  }

  const stripe = createStripeServerClient();
  const appUrl = getAppUrl();

  let session: Stripe.BillingPortal.Session;

  try {
    session = await stripe.billingPortal.sessions.create({
      customer: billingSnapshot.stripe_customer_id,
      return_url: `${appUrl}/${locale}/billing`,
    });
  } catch {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingPortalUnavailable')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.billingPortalOpened,
    locale,
    userId: user.id,
    metadata: {
      stripe_customer_id: billingSnapshot.stripe_customer_id,
      current_subscription_status: billingSnapshot.subscription_status,
    },
  });

  if (!session.url) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingPortalUnavailable')));
  }

  redirect(session.url);
}
