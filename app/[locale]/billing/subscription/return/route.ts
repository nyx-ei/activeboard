import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { getBillingPlanByPriceId } from '@/lib/stripe/pricing';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withFeedback } from '@/lib/utils';
import { deriveUserTier } from '@/lib/billing/user-tier';

type RouteContext = {
  params: {
    locale: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  const requestUrl = new URL(request.url);
  const sessionId = requestUrl.searchParams.get('session_id');
  const locale: AppLocale = routing.locales.includes(params.locale as AppLocale)
    ? (params.locale as AppLocale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Billing' });

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/auth/login`, requestUrl.origin));
  }

  if (!sessionId) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('missingStripeSession')), requestUrl.origin),
    );
  }

  const isBillingEnabled = await isFeatureEnabled('canUseStripeBilling');
  if (!isBillingEnabled || !hasStripeEnv()) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')), requestUrl.origin),
    );
  }

  const stripe = createStripeServerClient();
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

  if (checkoutSession.mode !== 'subscription' || checkoutSession.status !== 'complete') {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('subscriptionCheckoutIncomplete')), requestUrl.origin),
    );
  }

  if (checkoutSession.metadata?.userId !== user.id) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('billingSessionMismatch')), requestUrl.origin),
    );
  }

  const customerId =
    typeof checkoutSession.customer === 'string' ? checkoutSession.customer : checkoutSession.customer?.id ?? null;
  const subscriptionId =
    typeof checkoutSession.subscription === 'string'
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id ?? null;

  if (!customerId || !subscriptionId) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('subscriptionDataIncomplete')), requestUrl.origin),
    );
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end ?? null;
  const plan = await getBillingPlanByPriceId(priceId, locale);
  const { data: userBilling } = await supabase
    .schema('public')
    .from('users')
    .select('questions_answered')
    .eq('id', user.id)
    .maybeSingle();
  const nextUserTier = deriveUserTier({
    questionsAnswered: userBilling?.questions_answered ?? 0,
    hasValidPaymentMethod: true,
    subscriptionStatus: subscription.status,
  });

  await supabase
    .schema('public')
    .from('users')
    .update({
      stripe_customer_id: customerId,
      has_valid_payment_method: true,
      subscription_status: subscription.status,
      user_tier: nextUserTier,
      subscription_current_period_ends_at: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
    })
    .eq('id', user.id);

  await logAppEvent({
    eventName: APP_EVENTS.subscriptionCheckoutCompleted,
    locale,
    userId: user.id,
    metadata: {
      stripe_customer_id: customerId,
      subscription_id: subscriptionId,
      subscription_status: subscription.status,
      plan_key: plan?.key ?? checkoutSession.metadata?.planKey ?? 'unknown',
      stripe_price_id: priceId,
    },
  });

  revalidatePath(`/${locale}/billing`);
  revalidatePath(`/${locale}/groups`);
  revalidatePath(`/${locale}/dashboard`);

  return NextResponse.redirect(
    new URL(withFeedback(`/${locale}/billing`, 'success', t('subscriptionStarted')), requestUrl.origin),
  );
}
