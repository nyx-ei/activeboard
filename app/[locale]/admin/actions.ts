'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';
import { canAccessAdminConsole } from '@/lib/admin/access';
import { requireUser } from '@/lib/auth';
import { getAppPolicySettingsForAdmin } from '@/lib/policy/app-policy';
import { DEFAULT_APP_POLICY_SETTINGS } from '@/lib/policy/defaults';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function parseInteger(
  formData: FormData,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

function parseText(formData: FormData, key: string, fallback: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value || fallback;
}

export async function updateAdminPolicySettingsAction(formData: FormData) {
  const locale = (formData.get('locale') === 'fr' ? 'fr' : 'en') as AppLocale;
  const user = await requireUser(locale);

  if (!canAccessAdminConsole(user.email)) {
    throw new Error('Not authorized');
  }

  const previousSettings = await getAppPolicySettingsForAdmin();
  const trialQuestionLimit = parseInteger(
    formData,
    'trialQuestionLimit',
    previousSettings.trialQuestionLimit,
    1,
    10000,
  );
  const trialWarningThreshold = Math.min(
    parseInteger(
      formData,
      'trialWarningThreshold',
      previousSettings.trialWarningThreshold,
      0,
      10000,
    ),
    trialQuestionLimit,
  );
  const newTrialMinQuestions = parseInteger(
    formData,
    'newTrialMinQuestions',
    previousSettings.newTrialMinQuestions,
    1,
    10000,
  );
  const newTrialMaxQuestions = Math.max(
    newTrialMinQuestions,
    parseInteger(
      formData,
      'newTrialMaxQuestions',
      previousSettings.newTrialMaxQuestions,
      1,
      10000,
    ),
  );
  const maxQuestionGoal = parseInteger(
    formData,
    'maxQuestionGoal',
    previousSettings.maxQuestionGoal,
    1,
    10000,
  );
  const defaultQuestionGoal = Math.min(
    parseInteger(
      formData,
      'defaultQuestionGoal',
      previousSettings.defaultQuestionGoal,
      1,
      10000,
    ),
    maxQuestionGoal,
  );
  const maxTimerSeconds = parseInteger(
    formData,
    'maxTimerSeconds',
    previousSettings.maxTimerSeconds,
    1,
    86400,
  );
  const perQuestionTimerDefaultSeconds = Math.min(
    parseInteger(
      formData,
      'perQuestionTimerDefaultSeconds',
      previousSettings.perQuestionTimerDefaultSeconds,
      1,
      86400,
    ),
    maxTimerSeconds,
  );
  const globalTimerDefaultSeconds = Math.min(
    parseInteger(
      formData,
      'globalTimerDefaultSeconds',
      previousSettings.globalTimerDefaultSeconds,
      1,
      86400,
    ),
    maxTimerSeconds,
  );
  const completionMinMembers = parseInteger(
    formData,
    'completionMinMembers',
    previousSettings.completionMinMembers,
    1,
    100,
  );
  const completionMaxMembers = Math.max(
    completionMinMembers,
    parseInteger(
      formData,
      'completionMaxMembers',
      previousSettings.completionMaxMembers,
      1,
      100,
    ),
  );

  const nextSettings = {
    trial_question_limit: trialQuestionLimit,
    trial_warning_threshold: trialWarningThreshold,
    new_trial_min_questions: newTrialMinQuestions,
    new_trial_max_questions: newTrialMaxQuestions,
    new_trial_unlock_sessions: parseInteger(
      formData,
      'newTrialUnlockSessions',
      previousSettings.newTrialUnlockSessions,
      0,
      1000,
    ),
    consistent_trial_question_limit: parseInteger(
      formData,
      'consistentTrialQuestionLimit',
      previousSettings.consistentTrialQuestionLimit,
      1,
      10000,
    ),
    default_question_goal: defaultQuestionGoal,
    max_question_goal: maxQuestionGoal,
    per_question_timer_default_seconds: perQuestionTimerDefaultSeconds,
    global_timer_default_seconds: globalTimerDefaultSeconds,
    max_timer_seconds: maxTimerSeconds,
    minimum_group_members_to_start: parseInteger(
      formData,
      'minimumGroupMembersToStart',
      previousSettings.minimumGroupMembersToStart,
      1,
      100,
    ),
    completion_min_members: completionMinMembers,
    completion_max_members: completionMaxMembers,
    consistent_trial_unlock_condition_en: parseText(
      formData,
      'consistentTrialUnlockConditionEn',
      DEFAULT_APP_POLICY_SETTINGS.consistentTrialUnlockConditionEn,
    ),
    consistent_trial_unlock_condition_fr: parseText(
      formData,
      'consistentTrialUnlockConditionFr',
      DEFAULT_APP_POLICY_SETTINGS.consistentTrialUnlockConditionFr,
    ),
    paid_unlock_condition_en: parseText(
      formData,
      'paidUnlockConditionEn',
      DEFAULT_APP_POLICY_SETTINGS.paidUnlockConditionEn,
    ),
    paid_unlock_condition_fr: parseText(
      formData,
      'paidUnlockConditionFr',
      DEFAULT_APP_POLICY_SETTINGS.paidUnlockConditionFr,
    ),
    high_risk_session_limit_en: parseText(
      formData,
      'highRiskSessionLimitEn',
      DEFAULT_APP_POLICY_SETTINGS.highRiskSessionLimitEn,
    ),
    high_risk_session_limit_fr: parseText(
      formData,
      'highRiskSessionLimitFr',
      DEFAULT_APP_POLICY_SETTINGS.highRiskSessionLimitFr,
    ),
    high_risk_condition_en: parseText(
      formData,
      'highRiskConditionEn',
      DEFAULT_APP_POLICY_SETTINGS.highRiskConditionEn,
    ),
    high_risk_condition_fr: parseText(
      formData,
      'highRiskConditionFr',
      DEFAULT_APP_POLICY_SETTINGS.highRiskConditionFr,
    ),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const admin = createSupabaseAdminClient();
  const { error } = await (
    admin.schema('public') as unknown as {
      from: (table: 'app_policy_settings') => {
        update: (values: typeof nextSettings) => {
          eq: (
            column: 'id',
            value: 'default',
          ) => Promise<{ error: { message?: string } | null }>;
        };
      };
    }
  )
    .from('app_policy_settings')
    .update(nextSettings)
    .eq('id', 'default');

  if (error) {
    throw new Error(error.message ?? 'Failed to update policy settings');
  }

  await (
    admin.schema('public') as unknown as {
      from: (table: 'app_policy_settings_audit_log') => {
        insert: (values: {
          settings_id: 'default';
          changed_by: string;
          previous_settings: typeof previousSettings;
          next_settings: typeof nextSettings;
        }) => Promise<{ error: { message?: string } | null }>;
      };
    }
  )
    .from('app_policy_settings_audit_log')
    .insert({
      settings_id: 'default',
      changed_by: user.id,
      previous_settings: previousSettings,
      next_settings: nextSettings,
    });

  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/billing`);
  redirect(`/${locale}/admin?saved=1`);
}
