import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Lock } from 'lucide-react';

import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { HomeHeaderNav } from '@/components/layout/home-header-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { OfflineStatusBanner } from '@/components/pwa/offline-status-banner';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PwaLaunchTracker } from '@/components/pwa/pwa-launch-tracker';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
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
        const supabaseAdmin = createSupabaseAdminClient();
        const accessState = await getUserAccessState(user.id);
        const canBrowseLookupLayer = hasUserTierCapability(accessState, 'canBrowseLookupLayer');
        const { data: memberships } = await supabase
          .schema('public')
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);
        const groupIds = [...new Set((memberships ?? []).map((membership) => membership.group_id))];
        const { data: candidateGroups } = await supabaseAdmin
          .schema('public')
          .from('groups')
          .select('id, max_members')
          .order('created_at', { ascending: false })
          .limit(30);
        const candidateGroupIds = (candidateGroups ?? []).map((group) => group.id);
        const { data: candidateMemberships } =
          candidateGroupIds.length > 0
            ? await supabaseAdmin.schema('public').from('group_members').select('group_id').in('group_id', candidateGroupIds)
            : { data: [] };
        const candidateCounts = new Map<string, number>();
        for (const membership of candidateMemberships ?? []) {
          candidateCounts.set(membership.group_id, (candidateCounts.get(membership.group_id) ?? 0) + 1);
        }
        const liveGroupCount = (candidateGroups ?? []).filter(
          (group) => !groupIds.includes(group.id) && (candidateCounts.get(group.id) ?? 0) < (group.max_members ?? 5),
        ).length;
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
          liveGroupCount,
          canBrowseLookupLayer,
        };
      })()
    : { isCaptain: false, liveGroupCount: 0, canBrowseLookupLayer: false };
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
                  <Link
                    href={shellData.canBrowseLookupLayer ? '/groups?live=1' : '/billing'}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-amber-500/10 px-3 text-xs font-extrabold text-amber-400 ring-1 ring-amber-500/10 transition hover:bg-amber-500/15"
                    aria-label={`${dashboardT('joinLiveGroups')} ${shellData.liveGroupCount}`}
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />
                    {shellData.liveGroupCount}
                  </Link>
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
