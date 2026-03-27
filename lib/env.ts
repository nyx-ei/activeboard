type BrowserEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
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
