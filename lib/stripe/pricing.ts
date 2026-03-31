import type { AppLocale } from '@/i18n/routing';
import { getStripeServerEnv } from '@/lib/env';
import { createStripeServerClient } from '@/lib/stripe/server';

export const BILLING_PLAN_KEYS = {
  monthly: 'activeboard_monthly',
  yearly: 'activeboard_yearly',
} as const;

export type BillingPlanKey = (typeof BILLING_PLAN_KEYS)[keyof typeof BILLING_PLAN_KEYS];

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  stripePriceId: string;
  amountLabel: string;
  cadence: 'month' | 'year';
  highlight: boolean;
};

function formatAmount({
  amount,
  currency,
  locale,
}: {
  amount: number | null;
  currency: string;
  locale: AppLocale;
}) {
  if (amount === null) {
    return currency.toUpperCase();
  }

  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export async function getBillingPlans(locale: AppLocale): Promise<BillingPlanDefinition[]> {
  const { stripeMonthlyPriceId, stripeYearlyPriceId } = getStripeServerEnv();
  const stripe = createStripeServerClient();
  const plans: BillingPlanDefinition[] = [];

  if (stripeMonthlyPriceId) {
    const monthlyPrice = await stripe.prices.retrieve(stripeMonthlyPriceId);
    plans.push({
      key: BILLING_PLAN_KEYS.monthly,
      stripePriceId: stripeMonthlyPriceId,
      amountLabel: formatAmount({
        amount: monthlyPrice.unit_amount !== null ? monthlyPrice.unit_amount / 100 : null,
        currency: monthlyPrice.currency,
        locale,
      }),
      cadence: 'month',
      highlight: false,
    });
  }

  if (stripeYearlyPriceId) {
    const yearlyPrice = await stripe.prices.retrieve(stripeYearlyPriceId);
    plans.push({
      key: BILLING_PLAN_KEYS.yearly,
      stripePriceId: stripeYearlyPriceId,
      amountLabel: formatAmount({
        amount: yearlyPrice.unit_amount !== null ? yearlyPrice.unit_amount / 100 : null,
        currency: yearlyPrice.currency,
        locale,
      }),
      cadence: 'year',
      highlight: true,
    });
  }

  return plans;
}

export async function getBillingPlanByPriceId(priceId: string | null | undefined, locale: AppLocale) {
  if (!priceId) {
    return null;
  }

  const plans = await getBillingPlans(locale);
  return plans.find((plan) => plan.stripePriceId === priceId) ?? null;
}

export async function getBillingPlanByKey(planKey: string | null | undefined, locale: AppLocale) {
  if (!planKey) {
    return null;
  }

  const plans = await getBillingPlans(locale);
  return plans.find((plan) => plan.key === planKey) ?? null;
}
