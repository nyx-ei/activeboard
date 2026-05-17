import { createHash } from 'node:crypto';
import { getTranslations } from 'next-intl/server';

import { LandingGroupSetupForm } from '@/components/onboarding/landing-group-setup-form';
import type { AppLocale } from '@/i18n/routing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/types';
import { normalizeEmail } from '@/lib/utils';

type GroupSetupPageProps = {
  params: { locale: string };
  searchParams?: {
    token?: string;
  };
};

type GroupSetupState =
  | {
      status: 'ready';
      founderEmail: string;
      groupName: string;
      examSession: string;
      studyLanguage: AppLocale;
    }
  | { status: 'invalid' };

function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function readDraft(value: Json) {
  const draft =
    typeof value === 'string'
      ? (JSON.parse(value) as Record<string, unknown>)
      : (value as Record<string, unknown>);

  return {
    email: normalizeEmail(String(draft.email ?? '')),
    onboardingUserId:
      typeof draft.onboardingUserId === 'string' ? draft.onboardingUserId : '',
    groupName:
      typeof draft.groupName === 'string'
        ? draft.groupName
        : 'ActiveBoard Reliability Sprint',
    examSession:
      typeof draft.examSession === 'string'
        ? draft.examSession
        : 'planning_ahead',
    studyLanguage: (draft.locale === 'fr' ? 'fr' : 'en') as AppLocale,
  };
}

async function getGroupSetupState(token: string): Promise<GroupSetupState> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: landingToken } = await admin
      .schema('public')
      .from('landing_onboarding_tokens')
      .select('email, draft, expires_at, used_at')
      .eq('token_hash', hashPasswordSetupToken(token))
      .maybeSingle();

    if (
      !landingToken ||
      landingToken.used_at ||
      new Date(landingToken.expires_at).getTime() < Date.now()
    ) {
      return { status: 'invalid' };
    }

    const draft = readDraft(landingToken.draft);

    if (
      !draft.email ||
      !draft.onboardingUserId ||
      draft.email !== normalizeEmail(landingToken.email)
    ) {
      return { status: 'invalid' };
    }

    return {
      status: 'ready',
      founderEmail: draft.email,
      groupName: draft.groupName,
      examSession: draft.examSession,
      studyLanguage: draft.studyLanguage,
    };
  } catch {
    return { status: 'invalid' };
  }
}

export default async function LandingGroupSetupPage({
  searchParams,
}: GroupSetupPageProps) {
  const token = searchParams?.token ?? '';
  const t = await getTranslations('Auth');
  const setupState = token
    ? await getGroupSetupState(token)
    : ({ status: 'invalid' } as const);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-8">
      {token && setupState.status === 'ready' ? (
        <LandingGroupSetupForm
          token={token}
          founderEmail={setupState.founderEmail}
          initialGroupName={setupState.groupName}
          initialExamSession={setupState.examSession}
          initialStudyLanguage={setupState.studyLanguage}
          labels={{
            title: t('groupSetupTitle'),
            subtitle: t('groupSetupSubtitle'),
            groupName: t('groupSetupName'),
            groupNamePlaceholder: t('groupSetupNamePlaceholder'),
            targetExam: t('groupSetupTargetExam'),
            studyLanguage: t('groupSetupStudyLanguage'),
            teammateEmail: t('groupSetupTeammateEmail'),
            teammateEmailPlaceholder: t('groupSetupTeammateEmailPlaceholder'),
            addTeammate: t('groupSetupAddTeammate'),
            continue: t('groupSetupContinue'),
            skip: t('groupSetupSkip'),
            pending: t('groupSetupPending'),
            missingFields: t('missingFields'),
            invalidEmail: t('invalidEmail'),
            cannotInviteSelf: t('cannotInviteSelf'),
            inviteExists: t('inviteExists'),
            genericError: t('unexpectedError'),
            emailWarning: t('groupSetupEmailWarning'),
            examAprilMay2026: t('examAprilMay2026'),
            examAugustSeptember2026: t('examAugustSeptember2026'),
            examOctober2026: t('examOctober2026'),
            examPlanningAhead: t('examPlanningAhead'),
            languageEnglish: t('languageEnglish'),
            languageFrench: t('languageFrench'),
          }}
        />
      ) : (
        <div className="w-full max-w-[410px] rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {t('setPasswordInvalidLink')}
        </div>
      )}
    </main>
  );
}
