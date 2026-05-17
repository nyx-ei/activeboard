'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendAccountWelcomeEmail } from '@/lib/notifications/account';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { DEFAULT_AVAILABILITY_GRID } from '@/lib/schedule/availability';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/types';
import { generateInviteCode, normalizeEmail } from '@/lib/utils';

type FounderExamType = 'mccqe1' | 'usmle' | 'plab' | 'other';
type FounderExamSession =
  | 'april_may_2026'
  | 'august_september_2026'
  | 'october_2026'
  | 'planning_ahead';
type FounderPlan = 'starter' | 'unlimited';
type FounderDifficultyLevel = 'low' | 'medium' | 'high';
type FounderWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type FounderScheduleSlot = {
  weekday: FounderWeekday;
  startTime: string;
  endTime: string;
  questionGoal: number;
};

type FounderOnboardingDraft = {
  displayName: string;
  email: string;
  onboardingUserId?: string;
  passwordSetAt?: string;
  examType: FounderExamType;
  examSession: FounderExamSession;
  locale: AppLocale;
  timezone: string;
  plan: FounderPlan;
  difficultyLevel?: FounderDifficultyLevel;
  questionBanks: string[];
  schedule: FounderScheduleSlot[];
  groupName: string;
  memberEmails: string[];
};

type SetupPasswordResult =
  | {
      ok: true;
      groupId?: string;
      requiresGroupSetup?: boolean;
    }
  | {
      ok: false;
      reason:
        | 'missing_fields'
        | 'weak_password'
        | 'password_mismatch'
        | 'invalid_token'
        | 'invalid_onboarding_draft'
        | 'account_exists'
        | 'invite_exists'
        | 'unexpected_error';
    };

const VALID_EXAM_TYPES = new Set<FounderExamType>([
  'mccqe1',
  'usmle',
  'plab',
  'other',
]);
const VALID_DIFFICULTY_LEVELS = new Set<FounderDifficultyLevel>([
  'low',
  'medium',
  'high',
]);
const VALID_EXAM_SESSIONS = new Set<FounderExamSession>([
  'april_may_2026',
  'august_september_2026',
  'october_2026',
  'planning_ahead',
]);
const VALID_WEEKDAYS = new Set<FounderWeekday>([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function parseLandingDraft(value: Json): FounderOnboardingDraft | null {
  try {
    const draft =
      typeof value === 'string'
        ? (JSON.parse(value) as Partial<FounderOnboardingDraft>)
        : (value as Partial<FounderOnboardingDraft>);
    const normalizedBanks = [
      ...new Set(
        (draft.questionBanks ?? []).filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        ),
      ),
    ];
    const normalizedMembers = [
      ...new Set(
        (draft.memberEmails ?? [])
          .map((email) => normalizeEmail(String(email ?? '')))
          .filter(Boolean),
      ),
    ];
    const normalizedSchedule = (draft.schedule ?? [])
      .map((slot) => ({
        weekday: slot?.weekday,
        startTime: slot?.startTime?.trim(),
        endTime: slot?.endTime?.trim(),
        questionGoal: Number(slot?.questionGoal),
      }))
      .filter(
        (slot): slot is FounderScheduleSlot =>
          VALID_WEEKDAYS.has(slot.weekday as FounderWeekday) &&
          Boolean(slot.startTime) &&
          Boolean(slot.endTime) &&
          Number.isFinite(slot.questionGoal) &&
          slot.questionGoal > 0,
      )
      .map((slot) => ({
        weekday: slot.weekday as FounderWeekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        questionGoal: slot.questionGoal,
      }));

    if (
      typeof draft.displayName !== 'string' ||
      typeof draft.email !== 'string' ||
      !VALID_EXAM_TYPES.has(draft.examType as FounderExamType) ||
      !VALID_EXAM_SESSIONS.has(draft.examSession as FounderExamSession) ||
      (draft.locale !== 'en' && draft.locale !== 'fr') ||
      typeof draft.timezone !== 'string' ||
      (draft.plan !== 'starter' && draft.plan !== 'unlimited') ||
      typeof draft.groupName !== 'string'
    ) {
      return null;
    }

    return {
      displayName: draft.displayName.trim(),
      email: normalizeEmail(draft.email),
      onboardingUserId:
        typeof draft.onboardingUserId === 'string'
          ? draft.onboardingUserId
          : undefined,
      passwordSetAt:
        typeof draft.passwordSetAt === 'string'
          ? draft.passwordSetAt
          : undefined,
      examType: draft.examType as FounderExamType,
      examSession: draft.examSession as FounderExamSession,
      locale: draft.locale,
      timezone: draft.timezone.trim() || 'UTC',
      plan: draft.plan,
      difficultyLevel: VALID_DIFFICULTY_LEVELS.has(
        draft.difficultyLevel as FounderDifficultyLevel,
      )
        ? (draft.difficultyLevel as FounderDifficultyLevel)
        : 'medium',
      questionBanks: normalizedBanks,
      schedule: normalizedSchedule,
      groupName: draft.groupName.trim(),
      memberEmails: normalizedMembers,
    };
  } catch {
    return null;
  }
}

async function setupLandingAccount({
  tokenHash,
  draft,
  password,
}: {
  tokenHash: string;
  draft: FounderOnboardingDraft;
  password: string;
}): Promise<SetupPasswordResult> {
  const admin = createSupabaseAdminClient();
  const founderEmail = draft.email;

  if (!draft.displayName || !founderEmail) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (draft.onboardingUserId) {
    const { data: existingDraftUser, error: existingDraftUserError } =
      await admin
        .schema('public')
        .from('users')
        .select('id')
        .eq('id', draft.onboardingUserId)
        .eq('email', founderEmail)
        .maybeSingle();

    if (existingDraftUserError) {
      return { ok: false, reason: 'unexpected_error' };
    }

    if (existingDraftUser) {
      return { ok: true, requiresGroupSetup: true };
    }
  }

  const { data: existingUser, error: existingUserError } = await admin
    .schema('public')
    .from('users')
    .select('id')
    .eq('email', founderEmail)
    .maybeSingle();

  if (existingUserError) {
    return { ok: false, reason: 'unexpected_error' };
  }

  if (existingUser) {
    return { ok: false, reason: 'account_exists' };
  }

  const { data: createdAuthUser, error: authError } =
    await admin.auth.admin.createUser({
      email: founderEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: draft.displayName,
        locale: draft.locale,
      },
    });

  if (authError || !createdAuthUser.user?.id) {
    return { ok: false, reason: 'unexpected_error' };
  }

  const createdAuthUserId = createdAuthUser.user.id;

  try {
    await admin.schema('public').from('users').upsert(
      {
        id: createdAuthUserId,
        email: founderEmail,
        display_name: draft.displayName,
        locale: draft.locale,
        question_banks: draft.questionBanks,
      },
      { onConflict: 'id' },
    );

    await admin.schema('public').from('user_schedules').upsert({
      user_id: createdAuthUserId,
      timezone: draft.timezone,
      availability_grid: DEFAULT_AVAILABILITY_GRID,
    });

    const nextDraft: FounderOnboardingDraft = {
      ...draft,
      onboardingUserId: createdAuthUserId,
      passwordSetAt: new Date().toISOString(),
    };

    const { error: tokenUpdateError } = await admin
      .schema('public')
      .from('landing_onboarding_tokens')
      .update({ draft: nextDraft as unknown as Json })
      .eq('token_hash', tokenHash)
      .is('used_at', null);

    if (tokenUpdateError) {
      return { ok: false, reason: 'unexpected_error' };
    }

    if (hasEmailEnv()) {
      await sendAccountWelcomeEmail({
        locale: draft.locale,
        email: founderEmail,
        userId: createdAuthUserId,
        displayName: draft.displayName,
      });
    }

    return { ok: true, requiresGroupSetup: true };
  } catch {
    await admin
      .schema('public')
      .from('users')
      .delete()
      .eq('id', createdAuthUserId);
    await admin.auth.admin.deleteUser(createdAuthUserId);
    return { ok: false, reason: 'unexpected_error' };
  }
}

// Kept temporarily as a rollback path for the previous password-first onboarding flow.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function completeLandingOnboarding({
  tokenHash,
  draft,
  password,
}: {
  tokenHash: string;
  draft: FounderOnboardingDraft;
  password: string;
}): Promise<SetupPasswordResult> {
  const admin = createSupabaseAdminClient();
  const founderEmail = draft.email;
  const inviteEmails = draft.memberEmails
    .filter((email) => email !== founderEmail)
    .slice(0, 5);

  if (
    !draft.displayName ||
    !founderEmail ||
    !draft.groupName ||
    draft.questionBanks.length === 0
  ) {
    return { ok: false, reason: 'invalid_token' };
  }

  const { data: existingUser, error: existingUserError } = await admin
    .schema('public')
    .from('users')
    .select('id')
    .eq('email', founderEmail)
    .maybeSingle();

  if (existingUserError) {
    return { ok: false, reason: 'unexpected_error' };
  }

  if (existingUser) {
    return { ok: false, reason: 'account_exists' };
  }

  let createdAuthUserId: string | null = null;
  let groupId: string | null = null;
  let inviteCode = '';
  const cleanupInviteIds: string[] = [];

  try {
    const { data: createdAuthUser, error: authError } =
      await admin.auth.admin.createUser({
        email: founderEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: draft.displayName,
          locale: draft.locale,
          exam_type: draft.examType,
          exam_session: draft.examSession,
          question_banks: draft.questionBanks,
        },
      });

    if (authError || !createdAuthUser.user?.id) {
      return { ok: false, reason: 'unexpected_error' };
    }

    createdAuthUserId = createdAuthUser.user.id;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateInviteCode();
      const { data: existingGroup } = await admin
        .schema('public')
        .from('groups')
        .select('id')
        .eq('invite_code', candidate)
        .maybeSingle();

      if (!existingGroup) {
        inviteCode = candidate;
        break;
      }
    }

    if (!inviteCode) {
      return { ok: false, reason: 'unexpected_error' };
    }

    const { data: group, error: groupError } = await admin
      .schema('public')
      .from('groups')
      .insert({
        name: draft.groupName,
        invite_code: inviteCode,
        created_by: createdAuthUserId,
        difficulty_level: draft.difficultyLevel ?? 'medium',
        max_members: Math.max(2, Math.min(inviteEmails.length + 1, 6)),
      })
      .select('id')
      .single();

    if (groupError || !group?.id) {
      return { ok: false, reason: 'unexpected_error' };
    }

    groupId = group.id;

    const { error: founderMembershipError } = await admin
      .schema('public')
      .from('group_members')
      .insert({
        group_id: groupId,
        is_founder: true,
        user_id: createdAuthUserId,
      });

    if (founderMembershipError) {
      return { ok: false, reason: 'unexpected_error' };
    }

    if (draft.schedule.length > 0) {
      const { error: scheduleError } = await admin
        .schema('public')
        .from('group_weekly_schedules')
        .insert(
          draft.schedule.map((slot) => ({
            group_id: groupId!,
            weekday: slot.weekday,
            start_time: slot.startTime,
            end_time: slot.endTime,
            question_goal: slot.questionGoal,
          })),
        );

      if (scheduleError) {
        return { ok: false, reason: 'unexpected_error' };
      }
    }

    await admin.schema('public').from('users').upsert(
      {
        id: createdAuthUserId,
        email: founderEmail,
        display_name: draft.displayName,
        exam_type: draft.examType,
        exam_session: draft.examSession,
        locale: draft.locale,
        question_banks: draft.questionBanks,
      },
      { onConflict: 'id' },
    );

    await admin.schema('public').from('user_schedules').upsert({
      user_id: createdAuthUserId,
      timezone: draft.timezone,
      availability_grid: DEFAULT_AVAILABILITY_GRID,
    });

    const existingUsersByEmail = await Promise.all(
      inviteEmails.map(async (email) => {
        const { data: existingInvitee } = await admin
          .schema('public')
          .from('users')
          .select('id, email, display_name')
          .eq('email', email)
          .maybeSingle();
        return {
          email,
          userId: existingInvitee?.id ?? null,
          displayName: existingInvitee?.display_name ?? null,
        };
      }),
    );
    const invitees = existingUsersByEmail.filter(
      (entry) => entry.userId !== createdAuthUserId,
    );

    if (invitees.length > 0) {
      const { data: insertedInvites, error: inviteError } = await admin
        .schema('public')
        .from('group_invites')
        .insert(
          invitees.map((entry) => ({
            group_id: groupId!,
            invited_by: createdAuthUserId!,
            invitee_email: entry.email,
            invitee_user_id: entry.userId,
          })),
        )
        .select('id, invitee_email');

      if (inviteError) {
        return {
          ok: false,
          reason:
            inviteError.code === '23505' ? 'invite_exists' : 'unexpected_error',
        };
      }

      cleanupInviteIds.push(
        ...(insertedInvites ?? []).map((entry) => entry.id),
      );

      if ((insertedInvites ?? []).length > 0) {
        const { error: invitationSourceError } = await admin
          .schema('public')
          .from('invitations')
          .update({ source: 'onboarding' })
          .in(
            'group_invite_id',
            (insertedInvites ?? []).map((entry) => entry.id),
          );

        if (invitationSourceError) {
          console.error('Failed to tag onboarding invitations', {
            error: invitationSourceError.message,
          });
        }
      }
    }

    await logAppEvent({
      eventName: APP_EVENTS.groupCreated,
      locale: draft.locale,
      userId: createdAuthUserId,
      groupId,
      metadata: {
        source: 'landing_password_first_onboarding',
        plan: draft.plan,
        difficulty_level: draft.difficultyLevel ?? 'medium',
        exam_type: draft.examType,
        exam_session: draft.examSession,
        question_banks: draft.questionBanks,
        invite_count: invitees.length,
        existing_user_invite_count: invitees.filter((entry) =>
          Boolean(entry.userId),
        ).length,
        schedule_count: draft.schedule.length,
      },
      useAdmin: true,
    });

    if (hasEmailEnv()) {
      await sendAccountWelcomeEmail({
        locale: draft.locale,
        email: founderEmail,
        userId: createdAuthUserId,
        displayName: draft.displayName,
      });

      await Promise.all(
        invitees.map(async (entry) => {
          const inviteId =
            cleanupInviteIds[
              invitees.findIndex((invitee) => invitee.email === entry.email)
            ];

          if (!inviteId) {
            return;
          }

          await sendGroupInviteEmail({
            locale: draft.locale,
            inviteId,
            groupId: groupId!,
            groupName: draft.groupName,
            inviteCode,
            inviteeEmail: entry.email,
            inviteeExists: Boolean(entry.userId),
            inviterUserId: createdAuthUserId!,
            inviterName: draft.displayName,
          });
        }),
      );
    }

    const { error: markUsedError } = await admin
      .schema('public')
      .from('landing_onboarding_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('used_at', null);

    if (markUsedError) {
      return { ok: false, reason: 'unexpected_error' };
    }

    revalidatePath(`/${draft.locale}/dashboard`);
    revalidatePath(`/${draft.locale}/groups`);

    return {
      ok: true,
      groupId,
    };
  } catch {
    if (groupId) {
      await admin
        .schema('public')
        .from('group_invites')
        .delete()
        .eq('group_id', groupId);
      await admin
        .schema('public')
        .from('group_weekly_schedules')
        .delete()
        .eq('group_id', groupId);
      await admin
        .schema('public')
        .from('group_members')
        .delete()
        .eq('group_id', groupId);
      await admin.schema('public').from('groups').delete().eq('id', groupId);
    } else if (cleanupInviteIds.length > 0) {
      await admin
        .schema('public')
        .from('group_invites')
        .delete()
        .in('id', cleanupInviteIds);
    }

    if (createdAuthUserId) {
      await admin
        .schema('public')
        .from('user_schedules')
        .delete()
        .eq('user_id', createdAuthUserId);
      await admin
        .schema('public')
        .from('users')
        .delete()
        .eq('id', createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
    }

    return { ok: false, reason: 'unexpected_error' };
  }
}

export async function setupLandingPasswordAction(
  formData: FormData,
): Promise<SetupPasswordResult> {
  const token = ((formData.get('token') as string | null) ?? '').trim();
  const password = ((formData.get('password') as string | null) ?? '').trim();
  const confirmPassword = (
    (formData.get('confirmPassword') as string | null) ?? ''
  ).trim();

  if (!token || !password || !confirmPassword) {
    return { ok: false, reason: 'missing_fields' };
  }

  if (password !== confirmPassword) {
    return { ok: false, reason: 'password_mismatch' };
  }

  if (password.length < 8) {
    return { ok: false, reason: 'weak_password' };
  }

  const admin = createSupabaseAdminClient();
  const tokenHash = hashPasswordSetupToken(token);
  const { data: landingToken, error: landingTokenError } = await admin
    .schema('public')
    .from('landing_onboarding_tokens')
    .select('token_hash, email, draft, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (landingTokenError) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (landingToken) {
    if (
      landingToken.used_at ||
      new Date(landingToken.expires_at).getTime() < Date.now()
    ) {
      return { ok: false, reason: 'invalid_token' };
    }

    const draft = parseLandingDraft(landingToken.draft);
    if (!draft || draft.email !== normalizeEmail(landingToken.email)) {
      return { ok: false, reason: 'invalid_onboarding_draft' };
    }

    return setupLandingAccount({
      tokenHash,
      draft,
      password,
    });
  }

  const { data: setupToken, error: setupTokenError } = await admin
    .schema('public')
    .from('password_setup_tokens')
    .select('token_hash, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (
    setupTokenError ||
    !setupToken ||
    setupToken.used_at ||
    new Date(setupToken.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, reason: 'invalid_token' };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    setupToken.user_id,
    {
      password,
    },
  );

  if (updateError) {
    return { ok: false, reason: 'unexpected_error' };
  }

  const { error: markUsedError } = await admin
    .schema('public')
    .from('password_setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('used_at', null);

  if (markUsedError) {
    return { ok: false, reason: 'unexpected_error' };
  }

  return { ok: true };
}
