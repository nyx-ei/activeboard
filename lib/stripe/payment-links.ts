const DEFAULT_STRIPE_UNLIMITED_PAYMENT_LINK = 'https://buy.stripe.com/fZuaEP59w4Gc33k8P49k400';

function getConfiguredUnlimitedPaymentLink() {
  const configured = process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_PAYMENT_LINK?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_STRIPE_UNLIMITED_PAYMENT_LINK;
}

export function getUnlimitedPaymentLink(email?: string | null) {
  const url = new URL(getConfiguredUnlimitedPaymentLink());

  if (email) {
    url.searchParams.set('prefilled_email', email);
  }

  return url.toString();
}
