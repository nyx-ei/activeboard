import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { GroupSwitcherMenu } from '@/components/layout/group-switcher-menu';
import { HomeHeaderNav } from '@/components/layout/home-header-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { OfflineStatusBanner } from '@/components/pwa/offline-status-banner';
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
        if (groupIds.length === 0) return { groups: [], isCaptain: false, liveGroupCount, canBrowseLookupLayer };
        const { data: groups } = await supabase
          .schema('public')
          .from('groups')
          .select('id, name')
          .in('id', groupIds)
          .order('created_at', { ascending: false });
        const { data: schedules } = await supabase
          .schema('public')
          .from('group_weekly_schedules')
          .select('group_id, weekday, start_time, end_time, question_goal')
          .in('group_id', groupIds)
          .order('weekday', { ascending: true });
        const { data: membershipsWithUsers } = await supabaseAdmin
          .schema('public')
          .from('group_members')
          .select('group_id, user_id')
          .in('group_id', groupIds);
        const memberIds = [...new Set((membershipsWithUsers ?? []).map((membership) => membership.user_id))];
        const { data: memberProfiles } =
          memberIds.length > 0
            ? await supabaseAdmin
                .schema('public')
                .from('users')
                .select('id, display_name, email, avatar_url')
                .in('id', memberIds)
            : { data: [] };
        const scheduleByGroup = new Map<string, { scheduleLabel: string; weeklyQuestions: number }>();
        const memberProfileById = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile]));
        const membersPreviewByGroup = new Map<
          string,
          Array<{ id: string; initials: string; avatarUrl: string | null }>
        >();
        for (const groupId of groupIds) {
          const groupSchedules = (schedules ?? []).filter((schedule) => schedule.group_id === groupId);
          const weeklyQuestions = groupSchedules.reduce((sum, schedule) => sum + (schedule.question_goal ?? 0), 0);
          const firstSchedule = groupSchedules[0];
          scheduleByGroup.set(groupId, {
            scheduleLabel: firstSchedule
              ? `${firstSchedule.start_time?.slice(0, 5) ?? '--:--'} - ${firstSchedule.end_time?.slice(0, 5) ?? '--:--'}`
              : '',
            weeklyQuestions,
          });

          const memberPreview = (membershipsWithUsers ?? [])
            .filter((membership) => membership.group_id === groupId)
            .slice(0, 4)
            .map((membership) => {
              const profile = memberProfileById.get(membership.user_id);
              const displayLabel = profile?.display_name ?? profile?.email ?? 'AB';
              return {
                id: membership.user_id,
                initials: displayLabel
                  .split(' ')
                  .filter(Boolean)
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase(),
                avatarUrl: profile?.avatar_url ?? null,
              };
            });
          membersPreviewByGroup.set(groupId, memberPreview);
        }
        const { data: captainSession } = await supabase
          .schema('public')
          .from('sessions')
          .select('id')
          .eq('leader_id', user.id)
          .in('status', ['scheduled', 'active', 'incomplete'])
          .limit(1)
          .maybeSingle();
        return {
          groups: (groups ?? []).map((group) => {
            const scheduleMeta = scheduleByGroup.get(group.id);
            return {
              ...group,
              language: locale.toUpperCase(),
              scheduleLabel: scheduleMeta?.scheduleLabel ?? '',
              weeklyQuestions: scheduleMeta?.weeklyQuestions ?? 0,
              membersPreview: membersPreviewByGroup.get(group.id) ?? [],
            };
          }),
          isCaptain: Boolean(captainSession),
          liveGroupCount,
          canBrowseLookupLayer,
        };
      })()
    : { groups: [], isCaptain: false, liveGroupCount: 0, canBrowseLookupLayer: false };
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
          <OfflineStatusBanner />
          <header className="flex min-w-0 items-center justify-between gap-2 border-b border-[#1f2937]/80 pb-2 pt-1 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand text-xs font-extrabold text-white">
                  AB
                </div>
                <p className="truncate text-base font-extrabold tracking-tight text-white sm:text-lg">{t('appName')}</p>
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {user ? (
                <>
                  <Suspense
                    fallback={null}
                  >
                    <GroupSwitcherMenu
                      groups={shellData.groups}
                      liveGroupCount={shellData.liveGroupCount}
                      liveHref={shellData.canBrowseLookupLayer ? '/groups?live=1' : '/billing'}
                      userInitials={initials}
                      labels={{
                        myGroups: dashboardT('myGroups'),
                        active: dashboardT('activeGroup'),
                        selectHint: dashboardT('selectGroupHint'),
                        noSchedule: dashboardT('noSchedule'),
                        averageWeekly: dashboardT('averageWeeklyShort'),
                      }}
                    />
                  </Suspense>
                  <ProfileMenu
                    initials={initials}
                    name={displayName}
                    email={user.email ?? ''}
                    isCaptain={shellData.isCaptain}
                    locale={locale}
                    profileHref="/profile"
                    profileLabel={profileT('menuLabel')}
                    examHref="/profile?section=exam"
                    examLabel={profileT('examSettingsMenuLabel')}
                    billingHref="/billing"
                    billingLabel={billingT('menuLabel')}
                    languageLabel={locale === 'fr' ? t('english') : t('french')}
                  />
                </>
              ) : (
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
            }}
          />
        ) : null}
      </div>
    </NextIntlClientProvider>
  );
}
