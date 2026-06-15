export type AppPolicySettings = {
  trialQuestionLimit: number;
  trialWarningThreshold: number;
  newTrialMinQuestions: number;
  newTrialMaxQuestions: number;
  newTrialUnlockSessions: number;
  consistentTrialQuestionLimit: number;
  defaultQuestionGoal: number;
  maxQuestionGoal: number;
  perQuestionTimerDefaultSeconds: number;
  globalTimerDefaultSeconds: number;
  maxTimerSeconds: number;
  minimumGroupMembersToStart: number;
  completionMinMembers: number;
  completionMaxMembers: number;
  consistentTrialUnlockConditionEn: string;
  consistentTrialUnlockConditionFr: string;
  paidUnlockConditionEn: string;
  paidUnlockConditionFr: string;
  highRiskSessionLimitEn: string;
  highRiskSessionLimitFr: string;
  highRiskConditionEn: string;
  highRiskConditionFr: string;
};

export const DEFAULT_APP_POLICY_SETTINGS: AppPolicySettings = {
  trialQuestionLimit: 100,
  trialWarningThreshold: 85,
  newTrialMinQuestions: 10,
  newTrialMaxQuestions: 20,
  newTrialUnlockSessions: 3,
  consistentTrialQuestionLimit: 40,
  defaultQuestionGoal: 10,
  maxQuestionGoal: 500,
  perQuestionTimerDefaultSeconds: 90,
  globalTimerDefaultSeconds: 600,
  maxTimerSeconds: 3600,
  minimumGroupMembersToStart: 2,
  completionMinMembers: 2,
  completionMaxMembers: 5,
  consistentTrialUnlockConditionEn: 'Maintain review completion',
  consistentTrialUnlockConditionFr: 'Maintenir la révision',
  paidUnlockConditionEn: 'Immediate access',
  paidUnlockConditionFr: 'Accès immédiat',
  highRiskSessionLimitEn: 'Suggested smaller sessions',
  highRiskSessionLimitFr: 'Sessions plus courtes suggérées',
  highRiskConditionEn: 'Low completion or poor consistency',
  highRiskConditionFr: 'Faible complétion ou faible régularité',
};

export type SessionCreationPolicy = Pick<
  AppPolicySettings,
  | 'defaultQuestionGoal'
  | 'maxQuestionGoal'
  | 'perQuestionTimerDefaultSeconds'
  | 'globalTimerDefaultSeconds'
  | 'maxTimerSeconds'
  | 'minimumGroupMembersToStart'
>;

export const DEFAULT_SESSION_CREATION_POLICY: SessionCreationPolicy = {
  defaultQuestionGoal: DEFAULT_APP_POLICY_SETTINGS.defaultQuestionGoal,
  maxQuestionGoal: DEFAULT_APP_POLICY_SETTINGS.maxQuestionGoal,
  perQuestionTimerDefaultSeconds:
    DEFAULT_APP_POLICY_SETTINGS.perQuestionTimerDefaultSeconds,
  globalTimerDefaultSeconds:
    DEFAULT_APP_POLICY_SETTINGS.globalTimerDefaultSeconds,
  maxTimerSeconds: DEFAULT_APP_POLICY_SETTINGS.maxTimerSeconds,
  minimumGroupMembersToStart:
    DEFAULT_APP_POLICY_SETTINGS.minimumGroupMembersToStart,
};
