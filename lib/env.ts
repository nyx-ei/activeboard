type BrowserEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type SupabaseAdminEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

type StripeServerEnv = {
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  stripeWebhookSecret: string | null;
};

type EmailServerEnv = {
  mailerSendApiKey: string;
  mailerSendFromEmail: string;
  mailerSendFromName: string;
  sessionReminderCronSecret: string | null;
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

function getSupabaseServiceRoleKey() {
  return readOptionalEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
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

function getStripeWebhookSecret() {
  return readOptionalEnv(process.env.STRIPE_WEBHOOK_SECRET) ?? null;
}

function getMailerSendApiKey() {
  return readOptionalEnv(process.env.MAILERSEND_API_KEY);
}

function getMailerSendFromEmail() {
  return readOptionalEnv(process.env.MAILERSEND_FROM_EMAIL);
}

function getMailerSendFromName() {
  return readOptionalEnv(process.env.MAILERSEND_FROM_NAME) ?? 'ActiveBoard';
}

function getSessionReminderCronSecret() {
  return readOptionalEnv(process.env.SESSION_REMINDER_CRON_SECRET) ?? null;
}

export function hasStripeEnv(): boolean {
  return Boolean(getStripeSecretKey() && getStripePublishableKey());
}

export function hasStripeWebhookEnv(): boolean {
  return Boolean(getStripeSecretKey() && getStripeWebhookSecret());
}

export function hasEmailEnv(): boolean {
  return Boolean(getMailerSendApiKey() && getMailerSendFromEmail());
}

export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  const supabaseUrl = getPublicSupabaseUrl();
  const supabaseServiceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase admin configuration. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
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
    stripeWebhookSecret: getStripeWebhookSecret(),
  };
}

export function getEmailServerEnv(): EmailServerEnv {
  const mailerSendApiKey = getMailerSendApiKey();
  const mailerSendFromEmail = getMailerSendFromEmail();

  if (!mailerSendApiKey || !mailerSendFromEmail) {
    throw new Error(
      'Missing email configuration. Expected MAILERSEND_API_KEY and MAILERSEND_FROM_EMAIL.',
    );
  }

  return {
    mailerSendApiKey,
    mailerSendFromEmail,
    mailerSendFromName: getMailerSendFromName(),
    sessionReminderCronSecret: getSessionReminderCronSecret(),
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
