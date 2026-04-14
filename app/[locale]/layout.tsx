import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { GroupSwitcherMenu } from '@/components/layout/group-switcher-menu';
import { HomeHeaderNav } from '@/components/layout/home-header-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
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
  const shellData = user
    ? await (async () => {
        const supabase = createSupabaseServerClient();
        const { data: memberships } = await supabase
          .schema('public')
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);
        const groupIds = [...new Set((memberships ?? []).map((membership) => membership.group_id))];
        if (groupIds.length === 0) return { groups: [], isCaptain: false };
        const { data: groups } = await supabase
          .schema('public')
          .from('groups')
          .select('id, name')
          .in('id', groupIds)
          .order('created_at', { ascending: true });
        const { data: captainSession } = await supabase
          .schema('public')
          .from('sessions')
          .select('id')
          .eq('leader_id', user.id)
          .in('status', ['scheduled', 'active', 'incomplete'])
          .limit(1)
          .maybeSingle();
        return { groups: groups ?? [], isCaptain: Boolean(captainSession) };
      })()
    : { groups: [], isCaptain: false };
  const displayName = user?.user_metadata.full_name ?? user?.email ?? 'ActiveBoard';
  const initials =
    displayName
      ?.split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ??
    'AB';
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RegisterServiceWorker />
      <div className="min-h-screen overflow-x-hidden px-3 pb-24 pt-2 sm:px-6 sm:pt-4">
        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1240px] flex-col gap-5">
          <header className="flex min-w-0 items-center justify-between gap-2 border-b border-white/8 pb-2 pt-1 sm:gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand text-xs font-extrabold text-white">
                AB
              </div>
              <p className="truncate text-base font-extrabold tracking-tight text-white sm:text-lg">{t('appName')}</p>
            </Link>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
                  <Link
                    href="/profile"
                    className="relative flex h-8 w-8 items-center justify-center rounded-full border border-brand/35 bg-brand/20 text-xs font-extrabold text-brand shadow-[0_0_0_2px_rgba(16,185,129,0.05)] transition hover:bg-brand/30"
                    aria-label={profileT('menuLabel')}
                  >
                    {initials}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand" />
                    {shellData.isCaptain ? (
                      <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-extrabold uppercase leading-none text-[#3b2600]">
                        c
                      </span>
                    ) : null}
                  </Link>
                  <GroupSwitcherMenu
                    groups={shellData.groups}
                    labels={{
                      group: dashboardT('groupTab'),
                      profile: profileT('menuLabel'),
                      billing: billingT('menuLabel'),
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <HomeHeaderNav />
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
