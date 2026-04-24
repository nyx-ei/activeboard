import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { HomeHeaderNav } from '@/components/layout/home-header-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { LiveGroupsPill } from '@/components/layout/live-groups-pill';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { OfflineStatusBanner } from '@/components/pwa/offline-status-banner';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PwaLaunchTracker } from '@/components/pwa/pwa-launch-tracker';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
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
        const accessState = await getUserAccessState(user.id);
        const canBrowseLookupLayer = hasUserTierCapability(accessState, 'canBrowseLookupLayer');
        const { data: memberships } = await supabase
          .schema('public')
          .from('group_members')
          .select('group_id, joined_at')
          .eq('user_id', user.id);
        const preferredGroupId =
          [...(memberships ?? [])]
            .sort((left, right) => new Date(right.joined_at).getTime() - new Date(left.joined_at).getTime())[0]?.group_id ?? null;
        const { data: captainSession } = await supabase
          .schema('public')
          .from('sessions')
          .select('id')
          .eq('leader_id', user.id)
          .in('status', ['scheduled', 'active', 'incomplete'])
          .limit(1)
          .maybeSingle();
        return {
          isCaptain: Boolean(captainSession),
          canBrowseLookupLayer,
          preferredGroupId,
        };
      })()
    : { isCaptain: false, canBrowseLookupLayer: false, preferredGroupId: null as string | null };
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
      <div className="min-h-screen overflow-x-hidden px-2 pb-24 pt-2 sm:px-6 sm:pt-4">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1240px] flex-col gap-4 sm:gap-5">
          <OfflineStatusBanner />
          <InstallPrompt locale={locale} />
          {user ? <PwaLaunchTracker locale={locale} /> : null}
          <header className="border-b border-[#1f2937]/80 pb-2 pt-1">
            <div className="flex min-w-0 items-start justify-between gap-3 sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
              <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand text-xs font-extrabold text-white">
                  AB
                </div>
                <p className="truncate text-base font-extrabold tracking-tight text-white sm:text-lg">{t('appName')}</p>
              </Link>
              {!user ? (
                <div className="hidden min-w-0 flex-1 items-center justify-end sm:flex">
                  <HomeHeaderNav />
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
              {user ? (
                <>
                  <Suspense
                    fallback={
                      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                        {t('language')}
                      </div>
                    }
                  >
                    <LanguageSwitcher />
                  </Suspense>
                  <LiveGroupsPill
                    href={shellData.canBrowseLookupLayer ? `${shellData.preferredGroupId ? `/groups/${shellData.preferredGroupId}` : '/groups'}?live=1` : '/billing'}
                    label={dashboardT('joinLiveGroups')}
                    canBrowseLookupLayer={shellData.canBrowseLookupLayer}
                  />
                  <ProfileMenu
                    initials={initials}
                    name={displayName}
                    email={user.email ?? ''}
                    isCaptain={shellData.isCaptain}
                    profileHref="/profile"
                    profileLabel={profileT('menuLabel')}
                    examHref="/profile?section=exam"
                    examLabel={profileT('examSettingsMenuLabel')}
                    billingHref="/billing"
                    billingLabel={billingT('menuLabel')}
                  />
                </>
              ) : (
                <div className="flex shrink-0 items-center gap-3">
                  <Suspense
                    fallback={
                      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                        {t('language')}
                      </div>
                    }
                  >
                    <LanguageSwitcher />
                  </Suspense>
                </div>
              )}
            </div>
            </div>
            {!user ? (
              <div className="mt-2.5 sm:hidden">
                <HomeHeaderNav />
              </div>
            ) : null}
          </header>
          {children}
        </div>
        {user ? (
          <AppBottomNav
            locale={locale}
            groupsHref={shellData.preferredGroupId ? `/groups/${shellData.preferredGroupId}` : '/groups'}
            labels={{
              sessions: t('navSessions'),
              performance: t('navPerformance'),
              group: t('navGroup'),
            }}
          />
        ) : null}
      </div>
    </NextIntlClientProvider>
  );
}
