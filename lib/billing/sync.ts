import type Stripe from 'stripe';

import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

type BillingSubscriptionStatus = Database['public']['Tables']['users']['Row']['subscription_status'];
type UserBillingTarget = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'stripe_default_payment_method_id'
>;

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

function extractSubscriptionDefaultPaymentMethodId(subscription: Stripe.Subscription): string | null {
  const defaultPaymentMethod = subscription.default_payment_method;

  if (typeof defaultPaymentMethod === 'string') {
    return defaultPaymentMethod;
  }

  if (defaultPaymentMethod?.id) {
    return defaultPaymentMethod.id;
  }

  return null;
}

function extractStripeCustomerId(resource: { customer: string | Stripe.Customer | Stripe.DeletedCustomer | null }) {
  if (resource.customer && typeof resource.customer !== 'string' && 'deleted' in resource.customer && resource.customer.deleted) {
    throw new Error('Unexpected deleted Stripe customer in webhook payload.');
  }

  const customerId =
    typeof resource.customer === 'string' ? resource.customer : resource.customer?.id ?? null;

  if (!customerId) {
    throw new Error('Missing Stripe customer id on webhook payload.');
  }

  return customerId;
}

async function requireUserBillingTargetByCustomerId(customerId: string): Promise<UserBillingTarget> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: user, error } = await supabaseAdmin
    .schema('public')
    .from('users')
    .select('id, stripe_default_payment_method_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    throw new Error(`Failed to resolve user for Stripe customer ${customerId}: ${error.message}`);
  }

  return user;
}

export async function syncUserBillingFromStripeSubscription({
  subscription,
  eventName,
}: {
  subscription: Stripe.Subscription;
  eventName: string;
}) {
  const customerId = extractStripeCustomerId(subscription);
  const user = await requireUserBillingTargetByCustomerId(customerId);
  const supabaseAdmin = createSupabaseAdminClient();

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end ?? null;
  const paymentMethodId =
    extractSubscriptionDefaultPaymentMethodId(subscription) ?? user.stripe_default_payment_method_id;

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
  const customerId = extractStripeCustomerId(invoice);
  const user = await requireUserBillingTargetByCustomerId(customerId);
  const supabaseAdmin = createSupabaseAdminClient();

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
