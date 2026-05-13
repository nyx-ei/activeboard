import { createHash } from 'node:crypto';
import { getTranslations } from 'next-intl/server';

import { LandingSetPasswordForm } from '@/components/auth/landing-set-password-form';
import type { AppLocale } from '@/i18n/routing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type SetPasswordPageProps = {
  params: { locale: string };
  searchParams?: {
    token?: string;
    next?: string;
  };
};

type PasswordSetupState =
  | { status: 'ready'; email: string }
  | { status: 'completed' }
  | { status: 'invalid' };

const RECENTLY_USED_TOKEN_GRACE_MS = 2 * 60 * 1000;

function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function isRecentlyUsed(usedAt: string | null) {
  return (
    Boolean(usedAt) &&
    Date.now() - new Date(usedAt as string).getTime() <
      RECENTLY_USED_TOKEN_GRACE_MS
  );
}

async function getPasswordSetupState(
  token: string,
): Promise<PasswordSetupState> {
  const admin = createSupabaseAdminClient();
  const tokenHash = hashPasswordSetupToken(token);
  const { data: landingToken } = await admin
    .schema('public')
    .from('landing_onboarding_tokens')
    .select('email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (
    landingToken &&
    !landingToken.used_at &&
    new Date(landingToken.expires_at).getTime() >= Date.now()
  ) {
    return { status: 'ready', email: landingToken.email };
  }

  if (isRecentlyUsed(landingToken?.used_at ?? null)) {
    return { status: 'completed' };
  }

  const { data: setupToken } = await admin
    .schema('public')
    .from('password_setup_tokens')
    .select('email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (
    setupToken &&
    !setupToken.used_at &&
    new Date(setupToken.expires_at).getTime() >= Date.now()
  ) {
    return { status: 'ready', email: setupToken.email };
  }

  if (isRecentlyUsed(setupToken?.used_at ?? null)) {
    return { status: 'completed' };
  }

  return { status: 'invalid' };
}

export default async function SetPasswordPage({
  params,
  searchParams,
}: SetPasswordPageProps) {
  const locale = params.locale as AppLocale;
  const t = await getTranslations('Auth');
  const token = searchParams?.token ?? '';
  const nextPath =
    typeof searchParams?.next === 'string' &&
    searchParams.next.startsWith(`/${locale}/`)
      ? searchParams.next
      : `/${locale}/dashboard`;
  const setupState = token
    ? await getPasswordSetupState(token)
    : ({ status: 'invalid' } as const);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
      {token && setupState.status === 'ready' ? (
        <LandingSetPasswordForm
          email={setupState.email}
          homeHref={`/${locale}`}
          token={token}
          nextPath={nextPath}
        />
      ) : setupState.status === 'completed' ? (
        <div className="border-brand/25 bg-brand/10 w-full max-w-[410px] rounded-[18px] border px-4 py-3 text-sm font-semibold text-brand">
          {t('setPasswordCompleted')}
        </div>
      ) : (
        <div className="w-full max-w-[410px] rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {t('setPasswordInvalidLink')}
        </div>
      )}
    </main>
  );
}
