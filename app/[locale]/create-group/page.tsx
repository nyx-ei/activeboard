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
        accountTitle: t('accountTitle'),
        accountSubtitle: t('accountSubtitle'),
        fullName: t('fullName'),
        fullNamePlaceholder: t('fullNamePlaceholder'),
        email: t('email'),
        emailPlaceholder: t('emailPlaceholder'),
        password: t('password'),
        passwordHint: t('passwordHint'),
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
        nextScheduleBanks: t('nextScheduleBanks'),
        scheduleTitle: t('scheduleTitle'),
        scheduleSubtitle: t('scheduleSubtitle'),
        addSlot: t('addSlot'),
        nextQuestionBanks: t('nextQuestionBanks'),
        questionBanksTitle: t('questionBanksTitle'),
        questionBanksSubtitle: t('questionBanksSubtitle'),
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
        banks: {
          cmc_prep: t('bankCmcPrep'),
          aceqbank: 'AceQbank',
          uworld: 'UWorld',
          canadaqbank: 'CanadaQBank',
          amboss: 'Amboss',
          other: t('bankOther'),
        },
      }}
    />
  );
}
