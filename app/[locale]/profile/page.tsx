import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Camera } from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { LogoutButton } from '@/components/auth/logout-button';
import { UserScheduleForm } from '@/components/dashboard/user-schedule-form';
import { PwaAdoptionReportCard } from '@/components/profile/pwa-adoption-report-card';
import { ExamSettingsForm, PasswordUpdateForm, ProfileDetailsForm } from '@/components/profile/profile-settings-forms';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserScheduleData } from '@/lib/demo/data';
import { getPwaAdoptionReport } from '@/lib/monitoring/pwa-adoption';
import { DEFAULT_AVAILABILITY_GRID } from '@/lib/schedule/availability';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { updateUserScheduleAction } from '../dashboard/actions';
import { updatePasswordAction, updateProfileAction } from './actions';

type ProfilePageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    section?: string;
  };
};

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Profile');
  const dashboardT = await getTranslations('Dashboard');
  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .schema('public')
    .from('users')
    .select('display_name, exam_session, question_banks')
    .eq('id', user.id)
    .maybeSingle();
  const { count: founderGroupCount } = await supabase
    .schema('public')
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_founder', true);
  const userSchedule = await getUserScheduleData(user.id);
  const pwaAdoptionReport = founderGroupCount ? await getPwaAdoptionReport() : null;
  const section = searchParams.section === 'exam' ? 'exam' : 'profile';
  const displayName = profile?.display_name ?? user.user_metadata.full_name ?? user.email?.split('@')[0] ?? 'ActiveBoard';
  const examSession = profile?.exam_session ?? (typeof user.user_metadata.exam_session === 'string' ? user.user_metadata.exam_session : '');
  const questionBanks = profile?.question_banks ?? (Array.isArray(user.user_metadata.question_banks)
    ? user.user_metadata.question_banks.filter((value): value is string => typeof value === 'string')
    : []);
  const avatarUrl = typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : null;
  const initials = displayName
    .split(' ')
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-black/72 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[480px]">
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

        <section className="max-h-[min(78vh,680px)] overflow-y-auto rounded-[15px] border border-white/[0.06] bg-[#11192c] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-extrabold tracking-tight text-white">{section === 'exam' ? t('examSettingsTitle') : t('title')}</h1>
            <Link href="/dashboard?view=sessions" prefetch={false} className="text-2xl leading-none text-slate-400 transition hover:text-white" aria-label={t('close')}>
              &times;
            </Link>
          </div>

          {section === 'profile' ? (
            <>
              <div className="mt-5 flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-brand/18 text-xl font-extrabold text-brand">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={68} height={68} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-brand text-slate-950 shadow-lg transition hover:bg-brand-strong">
                    <input type="file" accept="image/*" className="sr-only" />
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  </label>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold text-white">{displayName}</p>
                  <p className="truncate text-sm font-medium text-slate-400">{user.email}</p>
                </div>
              </div>

              <ProfileDetailsForm
                action={updateProfileAction}
                locale={locale}
                displayName={displayName}
                initialExamSession={examSession}
                initialQuestionBanks={questionBanks}
                labels={{
                  displayName: t('displayName'),
                  examSession: t('examSession'),
                  selectPlaceholder: t('selectPlaceholder'),
                  examAprilMay2026: t('examAprilMay2026'),
                  examAugustSeptember2026: t('examAugustSeptember2026'),
                  examOctober2026: t('examOctober2026'),
                  examPlanningAhead: t('examPlanningAhead'),
                  questionBanks: t('questionBanks'),
                  bankCmcPrep: t('bankCmcPrep'),
                  otherBank: t('otherBank'),
                  saveProfile: t('saveProfile'),
                  saveProfilePending: t('saveProfilePending'),
                }}
              />

              <PasswordUpdateForm
                action={updatePasswordAction}
                locale={locale}
                labels={{
                  securityTitle: t('securityTitle'),
                  passwordPlaceholder: t('passwordPlaceholder'),
                  passwordHint: t('passwordHint'),
                  savePasswordPending: t('savePasswordPending'),
                  togglePassword: t('togglePassword'),
                }}
              />

              <div className="mt-4 flex justify-center border-t border-white/[0.06] pt-4">
                <LogoutButton
                  showIcon
                  className="min-h-0 border-none bg-transparent px-3 py-1 text-sm font-bold text-[#ff4d5e] shadow-none hover:bg-transparent hover:text-[#ff7a86]"
                />
              </div>

              {pwaAdoptionReport ? (
                <PwaAdoptionReportCard
                  report={pwaAdoptionReport}
                  labels={{
                    title: t('pwaMonitoringTitle'),
                    description: t('pwaMonitoringDescription'),
                    loggingDisabled: t('pwaMonitoringDisabled'),
                    promptShown: t('pwaPromptShown'),
                    installAccepted: t('pwaInstallAccepted'),
                    homeScreenLaunch: t('pwaHomeScreenLaunch'),
                    events: t('pwaEvents'),
                    users: t('pwaUsers'),
                    sessionDeviceSplit: t('pwaSessionDeviceSplit'),
                    emptyState: t('pwaEmptyState'),
                    deviceLabels: {
                      mobile: t('pwaDeviceMobile'),
                      desktop: t('pwaDeviceDesktop'),
                      tablet: t('pwaDeviceTablet'),
                      unknown: t('pwaDeviceUnknown'),
                      bot: t('pwaDeviceUnknown'),
                    },
                  }}
                />
              ) : null}
            </>
          ) : (
            <>
              <ExamSettingsForm
                action={updateProfileAction}
                locale={locale}
                displayName={displayName}
                initialExamSession={examSession}
                initialQuestionBanks={questionBanks}
                labels={{
                  displayName: t('displayName'),
                  examSession: t('examSession'),
                  selectPlaceholder: t('selectPlaceholder'),
                  examAprilMay2026: t('examAprilMay2026'),
                  examAugustSeptember2026: t('examAugustSeptember2026'),
                  examOctober2026: t('examOctober2026'),
                  examPlanningAhead: t('examPlanningAhead'),
                  questionBanks: t('questionBanks'),
                  bankCmcPrep: t('bankCmcPrep'),
                  otherBank: t('otherBank'),
                  saveProfile: t('saveProfile'),
                  saveProfilePending: t('saveProfilePending'),
                }}
              />

              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <UserScheduleForm
                  compact
                  action={updateUserScheduleAction}
                  locale={locale}
                  initialTimezone={userSchedule?.timezone ?? 'UTC'}
                  initialGrid={userSchedule?.availability_grid ?? DEFAULT_AVAILABILITY_GRID}
                  labels={{
                    title: dashboardT('availabilityTitle'),
                    description: dashboardT('availabilityShortDescription'),
                    timezone: dashboardT('availabilityTimezone'),
                    save: dashboardT('availabilitySave'),
                    savePending: dashboardT('availabilitySavePending'),
                    empty: dashboardT('availabilityEmpty'),
                    slotsCount: dashboardT('availabilitySlotsCount', { count: '{count}' }),
                    weekdays: {
                      monday: dashboardT('weekdayMonday'),
                      tuesday: dashboardT('weekdayTuesday'),
                      wednesday: dashboardT('weekdayWednesday'),
                      thursday: dashboardT('weekdayThursday'),
                      friday: dashboardT('weekdayFriday'),
                      saturday: dashboardT('weekdaySaturday'),
                      sunday: dashboardT('weekdaySunday'),
                    },
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
