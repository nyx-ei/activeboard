import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { hasStripeEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { isFeatureEnabled } from '@/lib/features/flags';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withFeedback } from '@/lib/utils';

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

  if (checkoutSession.mode !== 'setup' || checkoutSession.status !== 'complete') {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('stripeSetupIncomplete')), requestUrl.origin),
    );
  }

  if (checkoutSession.metadata?.userId !== user.id) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('billingSessionMismatch')), requestUrl.origin),
    );
  }

  const customerId =
    typeof checkoutSession.customer === 'string' ? checkoutSession.customer : checkoutSession.customer?.id ?? null;
  const setupIntentId =
    typeof checkoutSession.setup_intent === 'string'
      ? checkoutSession.setup_intent
      : checkoutSession.setup_intent?.id ?? null;

  if (!customerId || !setupIntentId) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('stripeSetupDataIncomplete')), requestUrl.origin),
    );
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id ?? null;

  if (!paymentMethodId) {
    return NextResponse.redirect(
      new URL(withFeedback(`/${locale}/billing`, 'error', t('setupPaymentMethodMissing')), requestUrl.origin),
    );
  }

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  await supabase
    .schema('public')
    .from('users')
    .update({
      stripe_customer_id: customerId,
      stripe_default_payment_method_id: paymentMethodId,
      has_valid_payment_method: true,
      subscription_status: 'none',
    })
    .eq('id', user.id);

  await logAppEvent({
    eventName: APP_EVENTS.billingSetupCompleted,
    locale,
    userId: user.id,
    metadata: {
      stripe_customer_id: customerId,
      stripe_default_payment_method_id: paymentMethodId,
    },
  });

  return NextResponse.redirect(
    new URL(withFeedback(`/${locale}/billing`, 'success', t('paymentMethodAdded')), requestUrl.origin),
  );
}
