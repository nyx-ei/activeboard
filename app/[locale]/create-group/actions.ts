'use server';

import { revalidatePath } from 'next/cache';

import type { AppLocale } from '@/i18n/routing';
import { DEFAULT_AVAILABILITY_GRID } from '@/lib/schedule/availability';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendAccountWelcomeEmail } from '@/lib/notifications/account';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode, normalizeEmail } from '@/lib/utils';

type FounderExamType = 'mccqe1' | 'usmle' | 'plab' | 'other';
type FounderExamSession = 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead';
type FounderPlan = 'starter' | 'unlimited';
type FounderWeekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type FounderScheduleSlot = {
  weekday: FounderWeekday;
  startTime: string;
  endTime: string;
  questionGoal: number;
};

type FounderOnboardingDraft = {
  displayName: string;
  email: string;
  password?: string;
  examType: FounderExamType;
  examSession: FounderExamSession;
  locale: AppLocale;
  timezone: string;
  plan: FounderPlan;
  questionBanks: string[];
  schedule: FounderScheduleSlot[];
  groupName: string;
  memberEmails: string[];
};

type FounderOnboardingResult =
  | { ok: true; groupId: string; inviteCode: string; requiresLogin: boolean; emailDeliveryFailed: boolean }
  | {
      ok: false;
      reason:
        | 'missing_fields'
        | 'account_exists'
        | 'not_authenticated'
        | 'action_failed'
        | 'invite_exists';
    };

const VALID_EXAM_TYPES = new Set<FounderExamType>(['mccqe1', 'usmle', 'plab', 'other']);
const VALID_EXAM_SESSIONS = new Set<FounderExamSession>([
  'april_may_2026',
  'august_september_2026',
  'october_2026',
  'planning_ahead',
]);
const VALID_WEEKDAYS = new Set<FounderWeekday>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

function parseDraft(rawDraft: string): FounderOnboardingDraft | null {
  try {
    const draft = JSON.parse(rawDraft) as Partial<FounderOnboardingDraft>;
    const normalizedBanks = [...new Set((draft.questionBanks ?? []).filter((value): value is string => typeof value === 'string' && value.length > 0))];
    const normalizedMembers = [...new Set((draft.memberEmails ?? []).map((email) => normalizeEmail(email ?? '')).filter(Boolean))];
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
      password: typeof draft.password === 'string' ? draft.password : undefined,
      examType: draft.examType as FounderExamType,
      examSession: draft.examSession as FounderExamSession,
      locale: draft.locale,
      timezone: draft.timezone.trim() || 'UTC',
      plan: draft.plan,
      questionBanks: normalizedBanks,
      schedule: normalizedSchedule,
      groupName: draft.groupName.trim(),
      memberEmails: normalizedMembers,
    };
  } catch {
    return null;
  }
}

export async function completeFounderOnboardingAction(formData: FormData): Promise<FounderOnboardingResult> {
  const locale = formData.get('locale') as AppLocale;
  const rawDraft = ((formData.get('draft') as string | null) ?? '').trim();
  const draft = parseDraft(rawDraft);

  if (!draft) {
    return { ok: false, reason: 'missing_fields' };
  }

  const serverClient = createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const {
    data: { user: authUser },
  } = await serverClient.auth.getUser();

  const founderEmail = authUser?.email ? normalizeEmail(authUser.email) : draft.email;
  const inviteEmails = draft.memberEmails.filter((email) => email !== founderEmail).slice(0, 4);

  if (
    !draft.displayName ||
    !draft.email ||
    !draft.groupName ||
    draft.questionBanks.length === 0 ||
    inviteEmails.length < 1 ||
    (!authUser && (!draft.password || draft.password.length < 8))
  ) {
    return { ok: false, reason: 'missing_fields' };
  }

  let createdAuthUserId: string | null = null;
  let founderId = authUser?.id ?? null;
  let groupId: string | null = null;
  let inviteCode = '';
  const cleanupInviteIds: string[] = [];
  let shouldDeleteFounderProfile = false;

  try {
    if (!authUser) {
      const { data: existingUser } = await adminClient.schema('public').from('users').select('id').eq('email', draft.email).maybeSingle();

      if (existingUser) {
        return { ok: false, reason: 'account_exists' };
      }

      const { data: createdAuthUser, error: authError } = await adminClient.auth.admin.createUser({
        email: draft.email,
        password: draft.password!,
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
        return { ok: false, reason: 'action_failed' };
      }

      createdAuthUserId = createdAuthUser.user.id;
      founderId = createdAuthUserId;
      shouldDeleteFounderProfile = true;
    }

    if (!founderId) {
      return { ok: false, reason: 'not_authenticated' };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateInviteCode();
      const { data: existingGroup } = await adminClient.schema('public').from('groups').select('id').eq('invite_code', candidate).maybeSingle();

      if (!existingGroup) {
        inviteCode = candidate;
        break;
      }
    }

    if (!inviteCode) {
      return { ok: false, reason: 'action_failed' };
    }

    const { data: group, error: groupError } = await adminClient
      .schema('public')
      .from('groups')
      .insert({
        name: draft.groupName,
        invite_code: inviteCode,
        created_by: founderId,
      })
      .select('id')
      .single();

    if (groupError || !group?.id) {
      return { ok: false, reason: 'action_failed' };
    }

    groupId = group.id;

    const { error: founderMembershipError } = await adminClient.schema('public').from('group_members').insert({
      group_id: groupId,
      is_founder: true,
      user_id: founderId,
    });

    if (founderMembershipError) {
      return { ok: false, reason: 'action_failed' };
    }

    if (draft.schedule.length > 0) {
      const { error: scheduleError } = await adminClient.schema('public').from('group_weekly_schedules').insert(
        draft.schedule.map((slot) => ({
          group_id: group.id,
          weekday: slot.weekday,
          start_time: slot.startTime,
          end_time: slot.endTime,
          question_goal: slot.questionGoal,
        })),
      );

      if (scheduleError) {
        return { ok: false, reason: 'action_failed' };
      }
    }

    await adminClient.schema('public').from('users').upsert(
      {
        id: founderId,
        email: founderEmail,
        display_name: draft.displayName,
        exam_type: draft.examType,
        exam_session: draft.examSession,
        locale: draft.locale,
        question_banks: draft.questionBanks,
      },
      { onConflict: 'id' },
    );

    await adminClient.schema('public').from('user_schedules').upsert({
      user_id: founderId,
      timezone: draft.timezone,
      availability_grid: DEFAULT_AVAILABILITY_GRID,
    });

    const existingUsersByEmail = await Promise.all(
      inviteEmails.map(async (email) => {
        const { data: existingUser } = await adminClient.schema('public').from('users').select('id, email, display_name').eq('email', email).maybeSingle();
        return { email, userId: existingUser?.id ?? null, displayName: existingUser?.display_name ?? null };
      }),
    );

    const invitees = existingUsersByEmail.filter((entry) => entry.userId !== founderId);

    if (invitees.length > 0) {
      const { data: insertedInvites, error: inviteError } = await adminClient
        .schema('public')
        .from('group_invites')
        .insert(
          invitees.map((entry) => ({
            group_id: groupId!,
            invited_by: founderId!,
            invitee_email: entry.email,
            invitee_user_id: entry.userId,
          })),
        )
        .select('id, invitee_email');

      if (inviteError) {
        return { ok: false, reason: inviteError.code === '23505' ? 'invite_exists' : 'action_failed' };
      }

      cleanupInviteIds.push(...(insertedInvites ?? []).map((entry) => entry.id));
    }

    await logAppEvent({
      eventName: APP_EVENTS.groupCreated,
      locale,
      userId: founderId,
      groupId,
      metadata: {
        source: 'founder_onboarding_v2',
        plan: draft.plan,
        exam_type: draft.examType,
        exam_session: draft.examSession,
        question_banks: draft.questionBanks,
        invite_count: invitees.length,
        existing_user_invite_count: invitees.filter((entry) => Boolean(entry.userId)).length,
        schedule_count: draft.schedule.length,
      },
      useAdmin: true,
    });

    let emailDeliveryFailed = invitees.length > 0 && !hasEmailEnv();

    if (hasEmailEnv()) {
      if (createdAuthUserId) {
        await sendAccountWelcomeEmail({
          locale,
          email: founderEmail,
          userId: founderId,
          displayName: draft.displayName,
        });
      }

      const inviteEmailResults = await Promise.all(
        invitees.map(async (entry) => {
          const inviteId = cleanupInviteIds[invitees.findIndex((invitee) => invitee.email === entry.email)];

          if (!inviteId) {
            return { ok: false as const, errorMessage: 'Missing invite id for email delivery.' };
          }

          return sendGroupInviteEmail({
            locale,
            inviteId,
            groupId: groupId!,
            groupName: draft.groupName,
            inviteCode,
            inviteeEmail: entry.email,
            inviterUserId: founderId!,
            inviterName: draft.displayName,
          });
        }),
      );

      if (inviteEmailResults.some((result) => !result.ok)) {
        emailDeliveryFailed = true;
      }
    }

    revalidatePath(`/${locale}/dashboard`);
    revalidatePath(`/${locale}/groups`);

    return {
      ok: true,
      groupId,
      inviteCode,
      requiresLogin: !authUser,
      emailDeliveryFailed,
    };
  } catch {
    if (groupId) {
      await adminClient.schema('public').from('group_invites').delete().eq('group_id', groupId);
      await adminClient.schema('public').from('group_weekly_schedules').delete().eq('group_id', groupId);
      await adminClient.schema('public').from('group_members').delete().eq('group_id', groupId);
      await adminClient.schema('public').from('groups').delete().eq('id', groupId);
    } else {
      if (cleanupInviteIds.length > 0) {
        await adminClient.schema('public').from('group_invites').delete().in('id', cleanupInviteIds);
      }
    }

    if (createdAuthUserId && shouldDeleteFounderProfile) {
      await adminClient.schema('public').from('user_schedules').delete().eq('user_id', createdAuthUserId);
      await adminClient.schema('public').from('users').delete().eq('id', createdAuthUserId);
      await adminClient.auth.admin.deleteUser(createdAuthUserId);
    }

    return { ok: false, reason: 'action_failed' };
  }
}
