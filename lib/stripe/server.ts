import Stripe from 'stripe';

import { getStripeServerEnv } from '@/lib/env';

let stripeClient: Stripe | null = null;

export function createStripeServerClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const { stripeSecretKey } = getStripeServerEnv();
  stripeClient = new Stripe(stripeSecretKey);

  return stripeClient;
}
