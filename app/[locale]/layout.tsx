import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';

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
  const primaryGroupHref = `/${locale}/dashboard?view=settings`;
  const primaryGroupLabel = dashboardT('groupSettings');

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RegisterServiceWorker />
      <div className="min-h-screen px-3 pb-24 pt-2 sm:px-6 sm:pt-4">
        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1240px] flex-col gap-5">
          <header className="flex items-center justify-between gap-4 border-b border-white/8 pb-2 pt-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand text-xs font-extrabold text-white">
                AB
              </div>
              <p className="text-base font-extrabold tracking-tight text-white sm:text-lg">{t('appName')}</p>
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
                    groupHint={null}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/auth/login" className="button-ghost">
                    {t('signIn')}
                  </Link>
                </div>
              )}
            </div>
          </header>
          {children}
        </div>
        {user ? (
          <AppBottomNav
            locale={locale}
            labels={{
              sessions: t('navSessions'),
              performance: t('navPerformance'),
              group: t('navGroup'),
              settings: t('navSettings'),
            }}
          />
        ) : null}
      </div>
    </NextIntlClientProvider>
  );
}
