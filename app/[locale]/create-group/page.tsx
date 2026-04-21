import { getTranslations } from 'next-intl/server';

import { CreateGroupWizard } from '@/components/onboarding/create-group-wizard';
import type { AppLocale } from '@/i18n/routing';

type CreateGroupPageProps = {
  params: { locale: string };
};

export default async function CreateGroupPage({ params }: CreateGroupPageProps) {
  const locale = params.locale as AppLocale;
  const t = await getTranslations('CreateGroup');

  return (
    <CreateGroupWizard
      locale={locale}
      labels={{
        title: t('title'),
        examPeriodTitle: t('examPeriodTitle'),
        examPeriodSubtitle: t('examPeriodSubtitle'),
        examSession: t('examSession'),
        selectPlaceholder: t('selectPlaceholder'),
        examAprilMay2026: t('examAprilMay2026'),
        examAugustSeptember2026: t('examAugustSeptember2026'),
        examOctober2026: t('examOctober2026'),
        examPlanningAhead: t('examPlanningAhead'),
        next: t('next'),
        teamTitle: t('teamTitle'),
        teamSubtitle: t('teamSubtitle'),
        groupName: t('groupName'),
        groupNamePlaceholder: t('groupNamePlaceholder'),
        memberEmails: t('memberEmails'),
        memberEmailPlaceholder: t('memberEmailPlaceholder'),
        addMember: t('addMember'),
        studyScheduleTitle: t('studyScheduleTitle'),
        studyScheduleSubtitle: t('studyScheduleSubtitle'),
        setScheduleNow: t('setScheduleNow'),
        continueWithoutSchedule: t('continueWithoutSchedule'),
        nextTeam: t('nextTeam'),
        addSlot: t('addSlot'),
        createGroup: t('createGroup'),
        createdTitle: t('createdTitle'),
        createdDescription: t('createdDescription'),
        inviteCode: t('inviteCode'),
        copyInviteLink: t('copyInviteLink'),
        completionRule: t('completionRule'),
        goToDashboard: t('goToDashboard'),
        weekdays: {
          monday: t('weekdayMonday'),
          tuesday: t('weekdayTuesday'),
          wednesday: t('weekdayWednesday'),
          thursday: t('weekdayThursday'),
          friday: t('weekdayFriday'),
          saturday: t('weekdaySaturday'),
          sunday: t('weekdaySunday'),
        },
      }}
    />
  );
}
