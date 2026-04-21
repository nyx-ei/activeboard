import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AuthForm } from '@/components/auth/auth-form';
import { InviteOnboardingWizard } from '@/components/invite/invite-onboarding-wizard';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { DEFAULT_AVAILABILITY_GRID, normalizeAvailabilityGrid } from '@/lib/schedule/availability';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeEmail } from '@/lib/utils';

import { completeInviteOnboardingAction, respondToInviteAction } from '../../dashboard/actions';

type InvitePageProps = {
  params: { locale: string; inviteId: string };
};

type WeeklySchedule = {
  weekday: string;
  start_time: string;
  end_time: string;
};

function hasTimeOverlap(left: WeeklySchedule, right: WeeklySchedule) {
  if (left.weekday !== right.weekday) {
    return false;
  }

  return left.start_time < right.end_time && right.start_time < left.end_time;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const locale = params.locale as AppLocale;
  const inviteId = params.inviteId;
  const t = await getTranslations('InviteFlow');
  const profileT = await getTranslations('Profile');
  const createGroupT = await getTranslations('CreateGroup');
  const dashboardT = await getTranslations('Dashboard');
  const commonT = await getTranslations('Common');
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: invite } = await supabase
    .schema('public')
    .from('group_invites')
    .select('id, group_id, invitee_email, status')
    .eq('id', inviteId)
    .maybeSingle();

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[680px] items-center justify-center px-4 py-10">
        <section className="surface-mockup w-full max-w-[480px] p-6 text-center">
          <h1 className="text-2xl font-semibold text-white">{t('notFoundTitle')}</h1>
          <p className="mt-3 text-sm text-slate-400">{t('notFoundDescription')}</p>
          <Link href={`/${locale}`} className="button-primary mt-6 inline-flex h-12 items-center justify-center rounded-[8px] px-5 text-sm">
            {t('backHome')}
          </Link>
        </section>
      </main>
    );
  }

  const { data: group } = await supabase
    .schema('public')
    .from('groups')
    .select('id, name, invite_code, created_by')
    .eq('id', invite.group_id)
    .maybeSingle();

  if (!group) {
    redirect(`/${locale}`);
  }

  const [{ data: inviteSchedules }, founderProfileResult, founderScheduleResult] = await Promise.all([
    supabase
      .schema('public')
      .from('group_weekly_schedules')
      .select('weekday, start_time, end_time')
      .eq('group_id', invite.group_id)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true }),
    group.created_by
      ? supabase
          .schema('public')
          .from('users')
          .select('display_name, exam_session, question_banks, locale')
          .eq('id', group.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    group.created_by
      ? supabase
          .schema('public')
          .from('user_schedules')
          .select('availability_grid, timezone')
          .eq('user_id', group.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-[410px]">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">{t('joinTitle')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('joinDescription', { groupName: group.name })}</p>
          </div>
          <AuthForm
            initialMode="sign-in"
            redirectToOverride={`/${locale}/invite/${inviteId}`}
            signUpRedirectToOverride={`/${locale}/invite/${inviteId}`}
            requireExamSessionOnSignUp={false}
          />
        </section>
      </main>
    );
  }

  const normalizedInviteEmail = normalizeEmail(invite.invitee_email);
  const normalizedUserEmail = normalizeEmail(user.email ?? '');

  if (normalizedInviteEmail !== normalizedUserEmail) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[680px] items-center justify-center px-4 py-10">
        <section className="surface-mockup w-full max-w-[520px] p-6">
          <h1 className="text-2xl font-semibold text-white">{t('emailMismatchTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{t('emailMismatchDescription', { email: invite.invitee_email })}</p>
          <Link href={`/${locale}/auth/login?next=/${locale}/invite/${inviteId}`} className="button-primary mt-6 inline-flex h-12 items-center justify-center rounded-[8px] px-5 text-sm">
            {t('useMatchingAccount')}
          </Link>
        </section>
      </main>
    );
  }

  if (invite.status !== 'pending') {
    redirect(`/${locale}/groups/${invite.group_id}`);
  }

  const [currentProfileResult, currentScheduleResult, membershipsResult] = await Promise.all([
    supabase
      .schema('public')
      .from('users')
      .select('display_name, exam_session, question_banks, locale')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('user_schedules')
      .select('availability_grid, timezone')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.schema('public').from('group_members').select('group_id').eq('user_id', user.id),
  ]);

  const memberGroupIds = (membershipsResult.data ?? [])
    .map((membership) => membership.group_id)
    .filter((groupId) => groupId !== invite.group_id);

  const [overlappingSchedulesResult, existingGroupsResult] =
    memberGroupIds.length > 0
      ? await Promise.all([
          supabase
            .schema('public')
            .from('group_weekly_schedules')
            .select('group_id, weekday, start_time, end_time')
            .in('group_id', memberGroupIds),
          supabase.schema('public').from('groups').select('id, name').in('id', memberGroupIds),
        ])
      : [
          { data: [] as Array<{ group_id: string; weekday: string; start_time: string; end_time: string }> },
          { data: [] as Array<{ id: string; name: string }> },
        ];

  const existingGroupNames = new Map((existingGroupsResult.data ?? []).map((existingGroup) => [existingGroup.id, existingGroup.name]));
  const scheduleConflicts = (overlappingSchedulesResult.data ?? []).flatMap((existingSchedule) =>
    (inviteSchedules ?? [])
      .filter((inviteSchedule) => hasTimeOverlap(existingSchedule, inviteSchedule))
      .map((inviteSchedule) => ({
        groupName: existingGroupNames.get(existingSchedule.group_id) ?? t('existingGroupFallback'),
        weekday: inviteSchedule.weekday,
        startTime: inviteSchedule.start_time,
        endTime: inviteSchedule.end_time,
      })),
  );

  const founderProfile = founderProfileResult.data;
  const founderSchedule = founderScheduleResult.data;
  const currentProfile = currentProfileResult.data;
  const currentSchedule = currentScheduleResult.data;

  const initialExamSession =
    currentProfile?.exam_session ??
    founderProfile?.exam_session ??
    (typeof user.user_metadata.exam_session === 'string' ? user.user_metadata.exam_session : '') ??
    '';

  const initialQuestionBanks =
    currentProfile?.question_banks?.length
      ? currentProfile.question_banks
      : founderProfile?.question_banks?.length
        ? founderProfile.question_banks
        : Array.isArray(user.user_metadata.question_banks)
          ? user.user_metadata.question_banks.filter((value): value is string => typeof value === 'string')
          : [];

  const initialLanguage =
    currentProfile?.locale === 'fr' || currentProfile?.locale === 'en'
      ? currentProfile.locale
      : founderProfile?.locale === 'fr' || founderProfile?.locale === 'en'
        ? founderProfile.locale
        : locale;

  const initialTimezone = currentSchedule?.timezone || founderSchedule?.timezone || 'UTC';
  const initialAvailabilityGrid = normalizeAvailabilityGrid(
    currentSchedule?.availability_grid ?? founderSchedule?.availability_grid ?? DEFAULT_AVAILABILITY_GRID,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[760px] items-center justify-center px-4 py-10">
      <InviteOnboardingWizard
        locale={locale}
        inviteId={inviteId}
        redirectTo={`/${locale}/groups/${invite.group_id}`}
        groupName={group.name}
        inviteCode={group.invite_code}
        inviteSchedules={inviteSchedules ?? []}
        scheduleConflicts={scheduleConflicts}
        initialExamSession={initialExamSession}
        initialLanguage={initialLanguage}
        initialTimezone={initialTimezone}
        initialQuestionBanks={initialQuestionBanks}
        initialAvailabilityGrid={initialAvailabilityGrid}
        completeAction={completeInviteOnboardingAction}
        declineAction={respondToInviteAction}
        labels={{
          inheritedHint: t('inheritedHint'),
          examStepTitle: t('examStepTitle'),
          examStepDescription: t('examStepDescription'),
          examSession: profileT('examSession'),
          selectPlaceholder: profileT('selectPlaceholder'),
          examAprilMay2026: profileT('examAprilMay2026'),
          examAugustSeptember2026: profileT('examAugustSeptember2026'),
          examOctober2026: profileT('examOctober2026'),
          examPlanningAhead: profileT('examPlanningAhead'),
          language: createGroupT('language'),
          languageEnglish: createGroupT('languageEnglish'),
          languageFrench: createGroupT('languageFrench'),
          timezone: createGroupT('timezone'),
          questionBanks: profileT('questionBanks'),
          bankCmcPrep: profileT('bankCmcPrep'),
          bankOther: profileT('otherBank'),
          next: commonT('continue'),
          back: commonT('back'),
          scheduleStepTitle: t('scheduleStepTitle'),
          scheduleStepDescription: t('scheduleStepDescription'),
          setScheduleNow: t('setScheduleNow'),
          continueWithoutSchedule: t('continueWithoutSchedule'),
          slotsCount: t('slotsCount'),
          empty: t('empty'),
          weekdays: {
            monday: dashboardT('weekdayMonday'),
            tuesday: dashboardT('weekdayTuesday'),
            wednesday: dashboardT('weekdayWednesday'),
            thursday: dashboardT('weekdayThursday'),
            friday: dashboardT('weekdayFriday'),
            saturday: dashboardT('weekdaySaturday'),
            sunday: dashboardT('weekdaySunday'),
          },
          reviewStepTitle: t('reviewStepTitle'),
          reviewStepDescription: t('reviewStepDescription'),
          invitationCode: t('inviteCodeLabel'),
          groupSchedule: t('groupSchedule'),
          noSchedule: t('noSchedule'),
          conflictTitle: t('conflictTitle'),
          conflictDescription: t('conflictDescription'),
          conflictNote: t('conflictNote'),
          decline: t('decline'),
          joinGroup: t('accept'),
          stepExam: t('stepExam'),
          stepSchedule: t('stepSchedule'),
          stepReview: t('stepReview'),
        }}
      />
    </main>
  );
}
