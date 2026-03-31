type BrowserEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type StripeServerEnv = {
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
};

function readOptionalEnv(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

function getPublicSupabaseUrl() {
  return readOptionalEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function getPublicSupabaseAnonKey() {
  return readOptionalEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseEnv(): boolean {
  return Boolean(getPublicSupabaseUrl() && getPublicSupabaseAnonKey());
}

export function getAppUrl(): string {
  return readOptionalEnv(process.env.NEXT_PUBLIC_APP_URL) ?? 'http://localhost:3000';
}

function getStripeSecretKey() {
  return readOptionalEnv(process.env.STRIPE_SECRET_KEY);
}

function getStripePublishableKey() {
  return readOptionalEnv(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

function getStripeMonthlyPriceId() {
  return readOptionalEnv(process.env.STRIPE_PRICE_ID_ACTIVEBOARD_MONTHLY) ?? null;
}

function getStripeYearlyPriceId() {
  return readOptionalEnv(process.env.STRIPE_PRICE_ID_ACTIVEBOARD_YEARLY) ?? null;
}

export function hasStripeEnv(): boolean {
  return Boolean(getStripeSecretKey() && getStripePublishableKey());
}

export function getStripeServerEnv(): StripeServerEnv {
  const stripeSecretKey = getStripeSecretKey();
  const stripePublishableKey = getStripePublishableKey();

  if (!stripeSecretKey || !stripePublishableKey) {
    throw new Error(
      'Missing Stripe configuration. Expected STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.',
    );
  }

  return {
    stripeSecretKey,
    stripePublishableKey,
    stripeMonthlyPriceId: getStripeMonthlyPriceId(),
    stripeYearlyPriceId: getStripeYearlyPriceId(),
  };
}

export function getBrowserEnv(): BrowserEnv {
  const supabaseUrl = getPublicSupabaseUrl();
  const supabaseAnonKey = getPublicSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration. Expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return {
    appUrl: getAppUrl(),
    supabaseUrl,
    supabaseAnonKey,
  };
}
