import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { Search } from 'lucide-react';

import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { LandingSignInLink } from '@/components/layout/landing-sign-in-link';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { LiveGroupsPill } from '@/components/layout/live-groups-pill';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { QuestionProgressRing } from '@/components/layout/question-progress-ring';
import { OfflineStatusBanner } from '@/components/pwa/offline-status-banner';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PwaLaunchTracker } from '@/components/pwa/pwa-launch-tracker';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import { TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function pickClientMessages(
  messages: Awaited<ReturnType<typeof getMessages>>,
  keys: Array<keyof Awaited<ReturnType<typeof getMessages>>>,
) {
  return keys.reduce<AbstractIntlMessages>((accumulator, key) => {
    accumulator[String(key)] = messages[key] as AbstractIntlMessages[string];
    return accumulator;
  }, {});
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
  const user = await getCurrentUser();
  const [messages, t, dashboardT, billingT, profileT, shellData] =
    await Promise.all([
      getMessages(),
      getTranslations('Common'),
      getTranslations('Dashboard'),
      getTranslations('Billing'),
      getTranslations('Profile'),
      user
        ? (async () => {
            const supabase = createSupabaseServerClient();
            const [accessState, membershipsResult] = await Promise.all([
              getUserAccessState(user.id),
              supabase
                .schema('public')
                .from('group_members')
                .select('group_id, joined_at, is_founder')
                .eq('user_id', user.id)
                .order('joined_at', { ascending: false }),
            ]);
            const memberships = membershipsResult.data ?? [];

            return {
              isCaptain: memberships.some(
                (membership) => membership.is_founder,
              ),
              hasGroups: memberships.length > 0,
              canBrowseLookupLayer: hasUserTierCapability(
                accessState,
                'canBrowseLookupLayer',
              ),
              isActive: accessState.snapshot?.user_tier === 'active',
              questionsAnswered: accessState.snapshot?.questions_answered ?? 0,
              preferredGroupId: memberships[0]?.group_id ?? null,
            };
          })()
        : Promise.resolve({
            isCaptain: false,
            hasGroups: false,
            canBrowseLookupLayer: false,
            isActive: false,
            questionsAnswered: 0,
            preferredGroupId: null as string | null,
          }),
    ]);
  const clientMessages = pickClientMessages(messages, [
    'Auth',
    'Common',
    'Landing',
    'Offline',
  ]);
  const displayName =
    user?.user_metadata.full_name ?? user?.email ?? 'ActiveBoard';
  const initials =
    displayName
      ?.split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? 'AB';
  return (
    <NextIntlClientProvider locale={locale} messages={clientMessages}>
      <RegisterServiceWorker />
      <div className="min-h-screen overflow-x-hidden px-2 pb-24 pt-2 sm:px-6 sm:pt-4">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1240px] flex-col gap-4 sm:gap-5">
          <OfflineStatusBanner />
          <InstallPrompt locale={locale} />
          {user ? <PwaLaunchTracker locale={locale} /> : null}
          <header
            className={
              user
                ? 'border-b border-[#1f2937]/80 pb-2 pt-1'
                : 'absolute right-3 top-3 z-50 border-0 p-0 sm:right-6 sm:top-4'
            }
          >
            <div className="flex min-w-0 items-start justify-between gap-3 sm:items-center sm:gap-4">
              {user ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
                  <Link
                    href="/"
                    className="flex min-w-0 shrink-0 items-center gap-2"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand text-xs font-extrabold text-white">
                      AB
                    </div>
                    <p className="truncate text-base font-extrabold tracking-tight text-white sm:text-lg">
                      {t('appName')}
                    </p>
                  </Link>
                </div>
              ) : null}

              <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
                {user ? (
                  <>
                    {shellData.canBrowseLookupLayer ? (
                      <Link
                        href="/lookup"
                        className="hover:border-brand/30 inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-white/[0.07] bg-white/[0.035] px-2.5 text-xs font-extrabold text-slate-200 transition hover:bg-white/[0.055] hover:text-white sm:px-3"
                      >
                        <Search
                          className="h-3.5 w-3.5 text-brand"
                          aria-hidden="true"
                          strokeWidth={2}
                        />
                        <span className="max-[520px]:sr-only">
                          {t('findPartners')}
                        </span>
                      </Link>
                    ) : null}
                    <Suspense
                      fallback={
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                          {t('language')}
                        </div>
                      }
                    >
                      <LanguageSwitcher persistUserPreference />
                    </Suspense>
                    {!shellData.isActive ? (
                      <QuestionProgressRing
                        answeredCount={shellData.questionsAnswered}
                        label={t('questionProgressLabel', {
                          current: Math.min(
                            shellData.questionsAnswered,
                            TRIAL_QUESTION_LIMIT,
                          ),
                          total: TRIAL_QUESTION_LIMIT,
                        })}
                      />
                    ) : null}
                    <LiveGroupsPill
                      href={
                        shellData.canBrowseLookupLayer
                          ? `${shellData.preferredGroupId ? `/groups/${shellData.preferredGroupId}` : '/groups'}?live=1`
                          : '/billing'
                      }
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
                      languageLabel={profileT('languagePreferenceMenuLabel')}
                      billingHref="/billing"
                      billingLabel={billingT('menuLabel')}
                    />
                  </>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                    <LandingSignInLink />
                    <Suspense
                      fallback={
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                          {t('language')}
                        </div>
                      }
                    >
                      <LanguageSwitcher persistUserPreference={false} />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>
          </header>
          {children}
        </div>
        {user ? (
          <AppBottomNav
            locale={locale}
            showGroupTab={shellData.hasGroups}
            groupsHref={
              shellData.preferredGroupId
                ? `/groups/${shellData.preferredGroupId}`
                : '/groups'
            }
            labels={{
              dashboard: t('navDashboard'),
              group: t('navGroup'),
            }}
          />
        ) : null}
      </div>
    </NextIntlClientProvider>
  );
}
