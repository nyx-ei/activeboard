import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { getStripeServerEnv, hasStripeWebhookEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import {
  syncUserBillingFromInvoiceFailure,
  syncUserBillingFromStripeSubscription,
} from '@/lib/billing/sync';
import { createStripeServerClient } from '@/lib/stripe/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasStripeWebhookEnv()) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 500 });
  }

  const stripe = createStripeServerClient();
  const { stripeWebhookSecret } = getStripeServerEnv();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !stripeWebhookSecret) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid Stripe webhook signature.',
      },
      { status: 400 },
    );
  }

  await logAppEvent({
    eventName: APP_EVENTS.stripeWebhookReceived,
    metadata: {
      stripe_event_id: event.id,
      stripe_event_name: event.type,
    },
    useAdmin: true,
  });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncUserBillingFromStripeSubscription({
          subscription: event.data.object as Stripe.Subscription,
          eventName: event.type,
        });
        break;
      }

      case 'invoice.payment_failed': {
        await syncUserBillingFromInvoiceFailure({
          invoice: event.data.object as Stripe.Invoice,
          eventName: event.type,
        });
        break;
      }

      default: {
        await logAppEvent({
          eventName: APP_EVENTS.stripeWebhookIgnored,
          metadata: {
            reason: 'unsupported_event_type',
            stripe_event_id: event.id,
            stripe_event_name: event.type,
          },
          useAdmin: true,
        });
      }
    }
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.stripeWebhookSyncFailed,
      level: 'error',
      metadata: {
        stripe_event_id: event.id,
        stripe_event_name: event.type,
        error_message: error instanceof Error ? error.message : 'Unknown webhook processing error',
      },
      useAdmin: true,
    });

    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
