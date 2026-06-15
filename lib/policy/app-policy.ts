import { cache } from 'react';

import {
  DEFAULT_APP_POLICY_SETTINGS,
  type AppPolicySettings,
} from '@/lib/policy/defaults';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type PolicySettingsRow = {
  trial_question_limit: number | null;
  trial_warning_threshold: number | null;
  new_trial_min_questions: number | null;
  new_trial_max_questions: number | null;
  new_trial_unlock_sessions: number | null;
  consistent_trial_question_limit: number | null;
  default_question_goal: number | null;
  max_question_goal: number | null;
  per_question_timer_default_seconds: number | null;
  global_timer_default_seconds: number | null;
  max_timer_seconds: number | null;
  minimum_group_members_to_start: number | null;
  completion_min_members: number | null;
  completion_max_members: number | null;
  consistent_trial_unlock_condition_en: string | null;
  consistent_trial_unlock_condition_fr: string | null;
  paid_unlock_condition_en: string | null;
  paid_unlock_condition_fr: string | null;
  high_risk_session_limit_en: string | null;
  high_risk_session_limit_fr: string | null;
  high_risk_condition_en: string | null;
  high_risk_condition_fr: string | null;
};

function numberOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function textOrDefault(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function normalizeAppPolicySettings(
  row: PolicySettingsRow | null | undefined,
): AppPolicySettings {
  if (!row) {
    return DEFAULT_APP_POLICY_SETTINGS;
  }

  const trialQuestionLimit = numberOrDefault(
    row.trial_question_limit,
    DEFAULT_APP_POLICY_SETTINGS.trialQuestionLimit,
  );
  const trialWarningThreshold = Math.min(
    numberOrDefault(
      row.trial_warning_threshold,
      DEFAULT_APP_POLICY_SETTINGS.trialWarningThreshold,
    ),
    trialQuestionLimit,
  );
  const maxQuestionGoal = numberOrDefault(
    row.max_question_goal,
    DEFAULT_APP_POLICY_SETTINGS.maxQuestionGoal,
  );
  const defaultQuestionGoal = Math.min(
    numberOrDefault(
      row.default_question_goal,
      DEFAULT_APP_POLICY_SETTINGS.defaultQuestionGoal,
    ),
    maxQuestionGoal,
  );
  const maxTimerSeconds = numberOrDefault(
    row.max_timer_seconds,
    DEFAULT_APP_POLICY_SETTINGS.maxTimerSeconds,
  );

  return {
    trialQuestionLimit,
    trialWarningThreshold,
    newTrialMinQuestions: numberOrDefault(
      row.new_trial_min_questions,
      DEFAULT_APP_POLICY_SETTINGS.newTrialMinQuestions,
    ),
    newTrialMaxQuestions: numberOrDefault(
      row.new_trial_max_questions,
      DEFAULT_APP_POLICY_SETTINGS.newTrialMaxQuestions,
    ),
    newTrialUnlockSessions: numberOrDefault(
      row.new_trial_unlock_sessions,
      DEFAULT_APP_POLICY_SETTINGS.newTrialUnlockSessions,
    ),
    consistentTrialQuestionLimit: numberOrDefault(
      row.consistent_trial_question_limit,
      DEFAULT_APP_POLICY_SETTINGS.consistentTrialQuestionLimit,
    ),
    defaultQuestionGoal,
    maxQuestionGoal,
    perQuestionTimerDefaultSeconds: Math.min(
      numberOrDefault(
        row.per_question_timer_default_seconds,
        DEFAULT_APP_POLICY_SETTINGS.perQuestionTimerDefaultSeconds,
      ),
      maxTimerSeconds,
    ),
    globalTimerDefaultSeconds: Math.min(
      numberOrDefault(
        row.global_timer_default_seconds,
        DEFAULT_APP_POLICY_SETTINGS.globalTimerDefaultSeconds,
      ),
      maxTimerSeconds,
    ),
    maxTimerSeconds,
    minimumGroupMembersToStart: numberOrDefault(
      row.minimum_group_members_to_start,
      DEFAULT_APP_POLICY_SETTINGS.minimumGroupMembersToStart,
    ),
    completionMinMembers: numberOrDefault(
      row.completion_min_members,
      DEFAULT_APP_POLICY_SETTINGS.completionMinMembers,
    ),
    completionMaxMembers: numberOrDefault(
      row.completion_max_members,
      DEFAULT_APP_POLICY_SETTINGS.completionMaxMembers,
    ),
    consistentTrialUnlockConditionEn: textOrDefault(
      row.consistent_trial_unlock_condition_en,
      DEFAULT_APP_POLICY_SETTINGS.consistentTrialUnlockConditionEn,
    ),
    consistentTrialUnlockConditionFr: textOrDefault(
      row.consistent_trial_unlock_condition_fr,
      DEFAULT_APP_POLICY_SETTINGS.consistentTrialUnlockConditionFr,
    ),
    paidUnlockConditionEn: textOrDefault(
      row.paid_unlock_condition_en,
      DEFAULT_APP_POLICY_SETTINGS.paidUnlockConditionEn,
    ),
    paidUnlockConditionFr: textOrDefault(
      row.paid_unlock_condition_fr,
      DEFAULT_APP_POLICY_SETTINGS.paidUnlockConditionFr,
    ),
    highRiskSessionLimitEn: textOrDefault(
      row.high_risk_session_limit_en,
      DEFAULT_APP_POLICY_SETTINGS.highRiskSessionLimitEn,
    ),
    highRiskSessionLimitFr: textOrDefault(
      row.high_risk_session_limit_fr,
      DEFAULT_APP_POLICY_SETTINGS.highRiskSessionLimitFr,
    ),
    highRiskConditionEn: textOrDefault(
      row.high_risk_condition_en,
      DEFAULT_APP_POLICY_SETTINGS.highRiskConditionEn,
    ),
    highRiskConditionFr: textOrDefault(
      row.high_risk_condition_fr,
      DEFAULT_APP_POLICY_SETTINGS.highRiskConditionFr,
    ),
  };
}

export const getAppPolicySettings = cache(async (): Promise<AppPolicySettings> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await (
    supabase.schema('public') as unknown as {
      from: (table: 'app_policy_settings') => {
        select: (columns: string) => {
          eq: (
            column: 'id',
            value: 'default',
          ) => {
            maybeSingle: () => Promise<{
              data: PolicySettingsRow | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from('app_policy_settings')
    .select(
      'trial_question_limit,trial_warning_threshold,new_trial_min_questions,new_trial_max_questions,new_trial_unlock_sessions,consistent_trial_question_limit,default_question_goal,max_question_goal,per_question_timer_default_seconds,global_timer_default_seconds,max_timer_seconds,minimum_group_members_to_start,completion_min_members,completion_max_members,consistent_trial_unlock_condition_en,consistent_trial_unlock_condition_fr,paid_unlock_condition_en,paid_unlock_condition_fr,high_risk_session_limit_en,high_risk_session_limit_fr,high_risk_condition_en,high_risk_condition_fr',
    )
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    console.warn('app_policy_settings unavailable; using defaults', {
      message: error.message,
    });
    return DEFAULT_APP_POLICY_SETTINGS;
  }

  return normalizeAppPolicySettings(data);
});

export async function getAppPolicySettingsForAdmin(): Promise<AppPolicySettings> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await (
    supabase.schema('public') as unknown as {
      from: (table: 'app_policy_settings') => {
        select: (columns: string) => {
          eq: (
            column: 'id',
            value: 'default',
          ) => {
            maybeSingle: () => Promise<{
              data: PolicySettingsRow | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from('app_policy_settings')
    .select(
      'trial_question_limit,trial_warning_threshold,new_trial_min_questions,new_trial_max_questions,new_trial_unlock_sessions,consistent_trial_question_limit,default_question_goal,max_question_goal,per_question_timer_default_seconds,global_timer_default_seconds,max_timer_seconds,minimum_group_members_to_start,completion_min_members,completion_max_members,consistent_trial_unlock_condition_en,consistent_trial_unlock_condition_fr,paid_unlock_condition_en,paid_unlock_condition_fr,high_risk_session_limit_en,high_risk_session_limit_fr,high_risk_condition_en,high_risk_condition_fr',
    )
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    console.warn('app_policy_settings unavailable via admin; using defaults', {
      message: error.message,
    });
    return DEFAULT_APP_POLICY_SETTINGS;
  }

  return normalizeAppPolicySettings(data);
}
