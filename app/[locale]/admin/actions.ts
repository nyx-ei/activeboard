'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';
import { canAccessAdminConsole } from '@/lib/admin/access';
import { requireUser } from '@/lib/auth';
import { getAppPolicySettingsForAdmin } from '@/lib/policy/app-policy';
import { DEFAULT_APP_POLICY_SETTINGS } from '@/lib/policy/defaults';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateInviteCode } from '@/lib/utils';

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

function parseGroupDifficulty(value: FormDataEntryValue | null) {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function parseUserIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll('memberUserIds')
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

async function createUniqueInviteCode(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode();
    const { data: existing } = await admin
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique invite code');
}

export async function composeAdminMatchmakerGroupAction(formData: FormData) {
  const locale = (formData.get('locale') === 'fr' ? 'fr' : 'en') as AppLocale;
  const user = await requireUser(locale);

  if (!canAccessAdminConsole(user.email)) {
    throw new Error('Not authorized');
  }

  const admin = createSupabaseAdminClient();
  const groupId = String(formData.get('groupId') ?? '').trim();
  const groupName = String(formData.get('groupName') ?? '').trim();
  const difficultyLevel = parseGroupDifficulty(formData.get('difficultyLevel'));
  const leaderUserId = String(formData.get('leaderUserId') ?? '').trim();
  const selectedUserIds = parseUserIds(formData);
  const memberUserIds = [
    ...new Set([leaderUserId, ...selectedUserIds].filter(Boolean)),
  ];
  const requestedMaxMembers = Number(formData.get('maxMembers'));
  const maxMembers = Math.min(
    Math.max(
      Number.isFinite(requestedMaxMembers) ? Math.round(requestedMaxMembers) : 5,
      memberUserIds.length,
      1,
    ),
    6,
  );

  if (!groupName || !leaderUserId || memberUserIds.length === 0) {
    redirect(`/${locale}/admin?matchmaker=missing#matchmaker`);
  }

  if (memberUserIds.length > 6) {
    redirect(`/${locale}/admin?matchmaker=too-many#matchmaker`);
  }

  const { data: existingUsers, error: usersError } = await admin
    .schema('public')
    .from('users')
    .select('id')
    .in('id', memberUserIds);

  if (usersError) {
    throw new Error(usersError.message);
  }

  if ((existingUsers ?? []).length !== memberUserIds.length) {
    redirect(`/${locale}/admin?matchmaker=invalid-user#matchmaker`);
  }

  let resolvedGroupId = groupId;
  let action: 'created' | 'updated' = 'updated';

  if (!resolvedGroupId) {
    const inviteCode = await createUniqueInviteCode(admin);
    const { data: group, error: groupError } = await admin
      .schema('public')
      .from('groups')
      .insert({
        name: groupName,
        invite_code: inviteCode,
        created_by: leaderUserId,
        difficulty_level: difficultyLevel,
        max_members: maxMembers,
      })
      .select('id')
      .single();

    if (groupError || !group?.id) {
      throw new Error(groupError?.message ?? 'Failed to create group');
    }

    resolvedGroupId = group.id;
    action = 'created';
  } else {
    const { data: activeSession, error: sessionError } = await admin
      .schema('public')
      .from('sessions')
      .select('id')
      .eq('group_id', resolvedGroupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (activeSession) {
      redirect(`/${locale}/admin?matchmaker=active-session#matchmaker`);
    }

    const { error: groupError } = await admin
      .schema('public')
      .from('groups')
      .update({
        name: groupName,
        created_by: leaderUserId,
        difficulty_level: difficultyLevel,
        max_members: maxMembers,
      })
      .eq('id', resolvedGroupId);

    if (groupError) {
      throw new Error(groupError.message);
    }
  }

  const { data: currentMembers, error: membersReadError } = await admin
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', resolvedGroupId);

  if (membersReadError) {
    throw new Error(membersReadError.message);
  }

  const nextMemberSet = new Set(memberUserIds);
  const usersToRemove = (currentMembers ?? [])
    .map((member) => member.user_id)
    .filter((userId) => !nextMemberSet.has(userId));

  if (usersToRemove.length > 0) {
    const { error: deleteError } = await admin
      .schema('public')
      .from('group_members')
      .delete()
      .eq('group_id', resolvedGroupId)
      .in('user_id', usersToRemove);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  const { error: upsertError } = await admin
    .schema('public')
    .from('group_members')
    .upsert(
      memberUserIds.map((memberUserId) => ({
        group_id: resolvedGroupId,
        user_id: memberUserId,
        is_founder: memberUserId === leaderUserId,
      })),
      { onConflict: 'group_id,user_id' },
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  await logAppEvent({
    eventName: 'admin_matchmaker_group_composed',
    locale,
    userId: user.id,
    groupId: resolvedGroupId,
    metadata: {
      action,
      member_count: memberUserIds.length,
      max_members: maxMembers,
      difficulty_level: difficultyLevel,
      leader_user_id: leaderUserId,
    },
    useAdmin: true,
  });

  await logAppEvent({
    eventName:
      action === 'created' ? APP_EVENTS.groupCreated : APP_EVENTS.groupMemberAdded,
    locale,
    userId: user.id,
    groupId: resolvedGroupId,
    metadata: {
      source: 'admin_matchmaker',
      member_count: memberUserIds.length,
      leader_user_id: leaderUserId,
    },
    useAdmin: true,
  });

  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/groups`);
  redirect(`/${locale}/admin?matchmaker=1&matchGroup=${resolvedGroupId}#matchmaker`);
}
