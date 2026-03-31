import type { User } from '@supabase/supabase-js';

import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type BillingSnapshot = Pick<
  Database['public']['Tables']['users']['Row'],
  'stripe_customer_id' | 'email'
>;

export async function ensureStripeCustomer(user: User, billingSnapshot: BillingSnapshot) {
  if (billingSnapshot.stripe_customer_id) {
    return billingSnapshot.stripe_customer_id;
  }

  const stripe = createStripeServerClient();
  const customer = await stripe.customers.create({
    email: user.email ?? billingSnapshot.email,
    name: user.user_metadata.full_name ?? user.user_metadata.name ?? undefined,
    metadata: {
      userId: user.id,
    },
  });

  const supabase = createSupabaseServerClient();
  await supabase
    .schema('public')
    .from('users')
    .update({
      stripe_customer_id: customer.id,
    })
    .eq('id', user.id);

  return customer.id;
}
