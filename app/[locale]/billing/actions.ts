'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getAppUrl, hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { ensureStripeCustomer } from '@/lib/stripe/customer';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withFeedback } from '@/lib/utils';

export async function createBillingSetupSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
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
    .select('email, stripe_customer_id, has_valid_payment_method, user_tier')
    .eq('id', user.id)
    .single();

  if (!billingSnapshot) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')));
  }

  const safeBillingSnapshot = billingSnapshot;

  const customerId = await ensureStripeCustomer(user, safeBillingSnapshot);
  const stripe = createStripeServerClient();
  const appUrl = getAppUrl();

  let session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      currency: 'usd',
      payment_method_types: ['card'],
      success_url: `${appUrl}/${locale}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${locale}/billing`,
      metadata: {
        userId: user.id,
        locale,
      },
    });
  } catch {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('checkoutInitializationFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.billingSetupStarted,
    locale,
    userId: user.id,
    metadata: {
      stripe_customer_id: customerId,
      current_user_tier: safeBillingSnapshot.user_tier,
      already_has_payment_method: safeBillingSnapshot.has_valid_payment_method,
    },
  });

  if (!session.url) {
    redirect(withFeedback(`/${locale}/billing`, 'error', t('billingUnavailable')));
  }

  redirect(session.url);
}
