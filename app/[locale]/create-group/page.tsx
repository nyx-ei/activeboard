import { getTranslations } from 'next-intl/server';

import { CreateGroupWizard } from '@/components/onboarding/create-group-wizard';
import type { AppLocale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type CreateGroupPageProps = {
  params: { locale: string };
};

export default async function CreateGroupPage({ params }: CreateGroupPageProps) {
  const locale = params.locale as AppLocale;
  const t = await getTranslations('CreateGroup');
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user?.id
    ? await supabase
        .schema('public')
        .from('users')
        .select('display_name, email, exam_type, exam_session, locale, question_banks')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };
  const schedule = user?.id
    ? await supabase.schema('public').from('user_schedules').select('timezone').eq('user_id', user.id).maybeSingle()
    : { data: null };

  return (
    <CreateGroupWizard
      locale={locale}
      isAuthenticated={Boolean(user)}
      initialProfile={
        user
          ? {
              displayName: profile.data?.display_name ?? user.user_metadata.full_name ?? user.email?.split('@')[0] ?? '',
              email: profile.data?.email ?? user.email ?? '',
              examType: (profile.data?.exam_type as 'mccqe1' | 'usmle' | 'plab' | 'other' | null) ?? '',
              examSession:
                (profile.data?.exam_session as
                  | 'april_may_2026'
                  | 'august_september_2026'
                  | 'october_2026'
                  | 'planning_ahead'
                  | null) ?? '',
              language: profile.data?.locale === 'fr' ? 'fr' : 'en',
              timezone: schedule.data?.timezone ?? 'UTC',
              questionBanks: profile.data?.question_banks ?? [],
            }
          : null
      }
      labels={{
        title: t('title'),
        accountTitle: t('accountTitle'),
        accountSubtitle: t('accountSubtitle'),
        fullName: t('fullName'),
        fullNamePlaceholder: t('fullNamePlaceholder'),
        email: t('email'),
        password: t('password'),
        passwordHint: t('passwordHint'),
        examType: t('examType'),
        examSession: t('examSession'),
        language: t('language'),
        timezone: t('timezone'),
        languageEnglish: t('languageEnglish'),
        languageFrench: t('languageFrench'),
        selectPlaceholder: t('selectPlaceholder'),
        examTypeMccqe1: t('examTypeMccqe1'),
        examTypeUsmle: t('examTypeUsmle'),
        examTypePlab: t('examTypePlab'),
        examTypeOther: t('examTypeOther'),
        examAprilMay2026: t('examAprilMay2026'),
        examAugustSeptember2026: t('examAugustSeptember2026'),
        examOctober2026: t('examOctober2026'),
        examPlanningAhead: t('examPlanningAhead'),
        stepAccount: t('stepAccount'),
        continueToPlan: t('continueToPlan'),
        planTitle: t('planTitle'),
        planSubtitle: t('planSubtitle'),
        stepPlan: t('stepPlan'),
        planStarter: t('planStarter'),
        planStarterDescription: t('planStarterDescription'),
        planUnlimited: t('planUnlimited'),
        planUnlimitedDescription: t('planUnlimitedDescription'),
        continueToSchedule: t('continueToSchedule'),
        studyScheduleTitle: t('studyScheduleTitle'),
        studyScheduleSubtitle: t('studyScheduleSubtitle'),
        stepSchedule: t('stepSchedule'),
        setScheduleNow: t('setScheduleNow'),
        continueWithoutSchedule: t('continueWithoutSchedule'),
        addSlot: t('addSlot'),
        weekdays: {
          monday: t('weekdayMonday'),
          tuesday: t('weekdayTuesday'),
          wednesday: t('weekdayWednesday'),
          thursday: t('weekdayThursday'),
          friday: t('weekdayFriday'),
          saturday: t('weekdaySaturday'),
          sunday: t('weekdaySunday'),
        },
        nextQuestionBanks: t('nextQuestionBanks'),
        banksTitle: t('banksTitle'),
        banksSubtitle: t('banksSubtitle'),
        stepBanks: t('stepBanks'),
        nextTeam: t('stepTeam'),
        bankCmcPrep: t('bankCmcPrep'),
        bankAceQbank: t('bankAceQbank'),
        bankUworld: t('bankUworld'),
        bankCanadaQbank: t('bankCanadaQbank'),
        bankAmboss: t('bankAmboss'),
        bankOther: t('bankOther'),
        teamTitle: t('teamTitle'),
        teamSubtitle: t('teamSubtitle'),
        stepTeam: t('stepTeam'),
        groupName: t('groupName'),
        groupNamePlaceholder: t('groupNamePlaceholder'),
        memberEmails: t('memberEmails'),
        memberEmailPlaceholder: t('memberEmailPlaceholder'),
        addMember: t('addMember'),
        createGroup: t('createGroup'),
        createGroupPending: t('createGroupPending'),
        accountExists: t('accountExists'),
        createdTitle: t('createdTitle'),
        createdDescription: t('createdDescription'),
        inviteCode: t('inviteCode'),
        copyInviteLink: t('copyInviteLink'),
        completionRule: t('completionRule'),
        inviteEmailWarning: t('inviteEmailWarning'),
        goToDashboard: t('goToDashboard'),
        signInToContinue: t('signInToContinue'),
        missingFields: t('missingFields'),
        genericError: t('genericError'),
      }}
    />
  );
}
