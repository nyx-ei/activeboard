import { getTranslations } from 'next-intl/server';

import { LandingSetPasswordForm } from '@/components/auth/landing-set-password-form';
import type { AppLocale } from '@/i18n/routing';

type SetPasswordPageProps = {
  params: { locale: string };
  searchParams?: {
    token?: string;
    next?: string;
  };
};

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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
      {token ? (
        <LandingSetPasswordForm token={token} nextPath={nextPath} />
      ) : (
        <div className="w-full max-w-[410px] rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {t('setPasswordInvalidLink')}
        </div>
      )}
    </main>
  );
}
