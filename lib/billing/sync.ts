import type Stripe from 'stripe';

import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { createStripeServerClient } from '@/lib/stripe/server';

type BillingSubscriptionStatus = Database['public']['Tables']['users']['Row']['subscription_status'];

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): BillingSubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'incomplete_expired';
    case 'paused':
      return 'paused';
    default:
      return 'none';
  }
}

async function resolveDefaultPaymentMethodId(subscription: Stripe.Subscription): Promise<string | null> {
  const defaultPaymentMethod = subscription.default_payment_method;

  if (typeof defaultPaymentMethod === 'string') {
    return defaultPaymentMethod;
  }

  if (defaultPaymentMethod?.id) {
    return defaultPaymentMethod.id;
  }

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;

  if (!customerId) {
    return null;
  }

  const stripe = createStripeServerClient();
  const customer = await stripe.customers.retrieve(customerId);
  const customerDefaultPaymentMethod =
    customer.deleted === true ? null : customer.invoice_settings.default_payment_method;

  if (typeof customerDefaultPaymentMethod === 'string') {
    return customerDefaultPaymentMethod;
  }

  return customerDefaultPaymentMethod?.id ?? null;
}

export async function syncUserBillingFromStripeSubscription({
  subscription,
  eventName,
}: {
  subscription: Stripe.Subscription;
  eventName: string;
}) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;

  if (!customerId) {
    await logAppEvent({
      eventName: APP_EVENTS.stripeWebhookIgnored,
      level: 'warn',
      metadata: {
        reason: 'missing_customer_id',
        stripe_event_name: eventName,
        subscription_id: subscription.id,
      },
      useAdmin: true,
    });
    return;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: user, error: userLookupError } = await supabaseAdmin
    .schema('public')
    .from('users')
    .select('id, stripe_customer_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (userLookupError || !user) {
    await logAppEvent({
      eventName: APP_EVENTS.stripeWebhookIgnored,
      level: 'warn',
      metadata: {
        reason: userLookupError ? 'user_lookup_failed' : 'user_not_found_for_customer',
        stripe_event_name: eventName,
        stripe_customer_id: customerId,
        subscription_id: subscription.id,
        error_message: userLookupError?.message,
      },
      useAdmin: true,
    });
    return;
  }

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end ?? null;
  const paymentMethodId = await resolveDefaultPaymentMethodId(subscription);

  const { error: updateError } = await supabaseAdmin
    .schema('public')
    .from('users')
    .update({
      stripe_customer_id: customerId,
      stripe_default_payment_method_id: paymentMethodId,
      has_valid_payment_method: Boolean(paymentMethodId),
      subscription_status: mapStripeSubscriptionStatus(subscription.status),
      subscription_current_period_ends_at: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
    })
    .eq('id', user.id);

  await logAppEvent({
    eventName: updateError ? APP_EVENTS.stripeWebhookSyncFailed : APP_EVENTS.stripeWebhookSynced,
    level: updateError ? 'error' : 'info',
    userId: user.id,
    metadata: {
      stripe_event_name: eventName,
      stripe_customer_id: customerId,
      subscription_id: subscription.id,
      subscription_status: subscription.status,
      stripe_default_payment_method_id: paymentMethodId,
      error_message: updateError?.message,
    },
    useAdmin: true,
  });
}

export async function syncUserBillingFromInvoiceFailure({
  invoice,
  eventName,
}: {
  invoice: Stripe.Invoice;
  eventName: string;
}) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;

  if (!customerId) {
    await logAppEvent({
      eventName: APP_EVENTS.stripeWebhookIgnored,
      level: 'warn',
      metadata: {
        reason: 'missing_customer_id',
        stripe_event_name: eventName,
        invoice_id: invoice.id,
      },
      useAdmin: true,
    });
    return;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: user, error: userLookupError } = await supabaseAdmin
    .schema('public')
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (userLookupError || !user) {
    await logAppEvent({
      eventName: APP_EVENTS.stripeWebhookIgnored,
      level: 'warn',
      metadata: {
        reason: userLookupError ? 'user_lookup_failed' : 'user_not_found_for_customer',
        stripe_event_name: eventName,
        stripe_customer_id: customerId,
        invoice_id: invoice.id,
        error_message: userLookupError?.message,
      },
      useAdmin: true,
    });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .schema('public')
    .from('users')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', user.id);

  await logAppEvent({
    eventName: updateError ? APP_EVENTS.stripeWebhookSyncFailed : APP_EVENTS.stripeInvoicePaymentFailed,
    level: updateError ? 'error' : 'warn',
    userId: user.id,
    metadata: {
      stripe_event_name: eventName,
      stripe_customer_id: customerId,
      invoice_id: invoice.id,
      error_message: updateError?.message,
    },
    useAdmin: true,
  });
}
