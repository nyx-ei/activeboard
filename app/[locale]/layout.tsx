import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const locale = params.locale as AppLocale;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations('Common');
  const dashboardT = await getTranslations('Dashboard');
  const billingT = await getTranslations('Billing');
  const profileT = await getTranslations('Profile');
  const user = await getCurrentUser();
  const displayName = user?.user_metadata.full_name ?? user?.email ?? 'ActiveBoard';
  const initials =
    displayName
      ?.split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ??
    'AB';
  let primaryGroupHref = `/${locale}/dashboard`;
  let primaryGroupLabel = dashboardT('groupSettings');
  let primaryGroupHint: string | null = null;

  if (user) {
    const supabase = createSupabaseServerClient();
    const { data: memberships } = await supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(10);

    const groupIds = [...new Set((memberships ?? []).map((membership) => membership.group_id))];

    if (groupIds.length === 1) {
      primaryGroupHref = `/${locale}/groups/${groupIds[0]}`;
    } else if (groupIds.length > 1) {
      primaryGroupHref = `/${locale}/dashboard#groups-list`;
      primaryGroupLabel = dashboardT('groups');
      primaryGroupHint = dashboardT('groupsMenuHint');
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RegisterServiceWorker />
      <div className="min-h-screen px-4 py-5 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1240px] flex-col gap-8">
          <header className="flex items-center justify-between gap-4 border-b border-white/8 pb-4 pt-1">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-extrabold text-white">
                AB
              </div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-extrabold tracking-tight text-white">{t('appName')}</p>
                <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                  PRE-QUAL
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Suspense
                fallback={
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                    {t('language')}
                  </div>
                }
              >
                <LanguageSwitcher />
              </Suspense>

              {user ? (
                <div className="flex items-center gap-2">
                  <ProfileMenu
                    initials={initials}
                    name={displayName}
                    email={user.email ?? ''}
                    profileHref={`/${locale}/profile`}
                    profileLabel={profileT('menuLabel')}
                    billingHref={`/${locale}/billing`}
                    billingLabel={billingT('menuLabel')}
                    groupHref={primaryGroupHref}
                    groupLabel={primaryGroupLabel}
                    groupHint={primaryGroupHint}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/auth/login" className="button-ghost">
                    {t('signIn')}
                  </Link>
                  <a href={`/${locale}/auth/login?mode=sign-up`} className="button-primary">
                    {t('createAccount')}
                  </a>
                </div>
              )}
            </div>
          </header>
          {children}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
