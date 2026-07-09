'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/types';
import { generateInviteCode, normalizeEmail } from '@/lib/utils';

type FounderExamSession =
  | 'april_may_2026'
  | 'august_september_2026'
  | 'october_2026'
  | 'planning_ahead';

type LandingGroupSetupDraft = {
  displayName: string;
  email: string;
  onboardingUserId?: string;
  examType?: 'mccqe_fr' | 'mccqe_en' | 'usmle' | 'plab' | 'other';
  examSession?: FounderExamSession;
  locale: AppLocale;
  timezone?: string;
  plan?: 'starter' | 'unlimited';
  difficultyLevel?: 'low' | 'medium' | 'high';
  questionBanks?: string[];
  schedule?: Array<{
    weekday: string;
    startTime: string;
    endTime: string;
    questionGoal: number;
  }>;
  groupName: string;
  memberEmails?: string[];
};

export type LandingGroupSetupResult =
  | {
      ok: true;
      groupId: string;
      emailWarning?: boolean;
    }
  | {
      ok: false;
      reason:
        | 'missing_fields'
        | 'invalid_token'
        | 'invalid_email'
        | 'cannot_invite_self'
        | 'invite_exists'
        | 'unexpected_error';
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_EXAM_SESSIONS = new Set<FounderExamSession>([
  'april_may_2026',
  'august_september_2026',
  'october_2026',
  'planning_ahead',
]);

function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function parseDraft(value: Json): LandingGroupSetupDraft | null {
  try {
    const draft =
      typeof value === 'string'
        ? (JSON.parse(value) as Partial<LandingGroupSetupDraft>)
        : (value as Partial<LandingGroupSetupDraft>);

    if (
      typeof draft.displayName !== 'string' ||
      typeof draft.email !== 'string' ||
      typeof draft.groupName !== 'string' ||
      typeof draft.onboardingUserId !== 'string' ||
      (draft.locale !== 'en' && draft.locale !== 'fr')
    ) {
      return null;
    }

    return {
      displayName: draft.displayName.trim(),
      email: normalizeEmail(draft.email),
      onboardingUserId: draft.onboardingUserId,
      examType: draft.examType ?? 'mccqe_en',
      examSession: VALID_EXAM_SESSIONS.has(
        draft.examSession as FounderExamSession,
      )
        ? (draft.examSession as FounderExamSession)
        : 'planning_ahead',
      locale: draft.locale,
      timezone: draft.timezone ?? 'UTC',
      plan: draft.plan ?? 'starter',
      difficultyLevel: draft.difficultyLevel ?? 'medium',
      questionBanks: Array.isArray(draft.questionBanks)
        ? draft.questionBanks.filter(
            (value): value is string =>
              typeof value === 'string' && value.length > 0,
          )
        : [],
      schedule: Array.isArray(draft.schedule) ? draft.schedule : [],
      groupName: draft.groupName.trim(),
      memberEmails: Array.isArray(draft.memberEmails)
        ? draft.memberEmails
            .map((email) => normalizeEmail(String(email ?? '')))
            .filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}

function parseInviteEmails(formData: FormData) {
  return Array.from({ length: 4 }, (_, index) =>
    normalizeEmail(
      (formData.get(`teammateEmail${index}`) as string | null) ?? '',
    ),
  ).filter(Boolean);
}

async function generateUniqueInviteCode() {
  const admin = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateInviteCode();
    const { data: existingGroup } = await admin
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();

    if (!existingGroup) {
      return candidate;
    }
  }

  return null;
}

export async function completeLandingGroupSetupAction(
  formData: FormData,
): Promise<LandingGroupSetupResult> {
  const token = ((formData.get('token') as string | null) ?? '').trim();
  const groupName = ((formData.get('groupName') as string | null) ?? '').trim();
  const examSession = (
    (formData.get('examSession') as string | null) ?? ''
  ).trim() as FounderExamSession;
  const studyLanguage =
    ((formData.get('studyLanguage') as string | null) ?? '').trim() === 'fr'
      ? 'fr'
      : 'en';
  const skipInvites = formData.get('skipInvites') === 'true';
  const inviteEmails = skipInvites
    ? []
    : Array.from(new Set(parseInviteEmails(formData)));

  if (
    !token ||
    !groupName ||
    !VALID_EXAM_SESSIONS.has(examSession) ||
    !studyLanguage
  ) {
    return { ok: false, reason: 'missing_fields' };
  }

  for (const email of inviteEmails) {
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, reason: 'invalid_email' };
    }
  }

  const admin = createSupabaseAdminClient();
  const tokenHash = hashPasswordSetupToken(token);
  const { data: landingToken, error: tokenError } = await admin
    .schema('public')
    .from('landing_onboarding_tokens')
    .select('token_hash, email, draft, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (
    tokenError ||
    !landingToken ||
    landingToken.used_at ||
    new Date(landingToken.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, reason: 'invalid_token' };
  }

  const draft = parseDraft(landingToken.draft);
  if (!draft || draft.email !== normalizeEmail(landingToken.email)) {
    return { ok: false, reason: 'invalid_token' };
  }

  const founderEmail = draft.email;
  const founderUserId = draft.onboardingUserId;

  if (!founderUserId) {
    return { ok: false, reason: 'invalid_token' };
  }
  const filteredInviteEmails = inviteEmails.filter(
    (email) => email !== founderEmail,
  );

  if (filteredInviteEmails.length !== inviteEmails.length) {
    return { ok: false, reason: 'cannot_invite_self' };
  }

  const inviteCode = await generateUniqueInviteCode();
  if (!inviteCode) {
    return { ok: false, reason: 'unexpected_error' };
  }

  let groupId: string | null = null;

  try {
    await admin.auth.admin.updateUserById(founderUserId, {
      user_metadata: {
        full_name: draft.displayName,
        locale: studyLanguage,
        exam_type: 'mccqe_en',
        exam_session: examSession,
        question_banks: draft.questionBanks,
      },
    });

    await admin
      .schema('public')
      .from('users')
      .upsert(
        {
          id: founderUserId,
          email: founderEmail,
          display_name: draft.displayName,
          exam_type: 'mccqe_en',
          exam_session: examSession,
          locale: studyLanguage,
          question_banks: draft.questionBanks ?? [],
        },
        { onConflict: 'id' },
      );

    const { data: group, error: groupError } = await admin
      .schema('public')
      .from('groups')
      .insert({
        name: groupName,
        invite_code: inviteCode,
        created_by: founderUserId,
        difficulty_level: draft.difficultyLevel ?? 'medium',
        max_members: 5,
      })
      .select('id')
      .single();

    if (groupError || !group?.id) {
      return { ok: false, reason: 'unexpected_error' };
    }

    groupId = group.id;

    const { error: membershipError } = await admin
      .schema('public')
      .from('group_members')
      .insert({
        group_id: groupId,
        is_founder: true,
        user_id: founderUserId,
      });

    if (membershipError) {
      throw new Error('founder_membership_failed');
    }

    const existingUsersByEmail = await Promise.all(
      filteredInviteEmails.map(async (email) => {
        const { data: existingInvitee } = await admin
          .schema('public')
          .from('users')
          .select('id, email')
          .eq('email', email)
          .maybeSingle();

        return {
          email,
          userId: existingInvitee?.id ?? null,
        };
      }),
    );

    let emailWarning = false;

    if (existingUsersByEmail.length > 0) {
      const { data: insertedInvites, error: inviteError } = await admin
        .schema('public')
        .from('group_invites')
        .insert(
          existingUsersByEmail.map((entry) => ({
            group_id: groupId!,
            invited_by: founderUserId,
            invitee_email: entry.email,
            invitee_user_id: entry.userId,
          })),
        )
        .select('id, invitee_email');

      if (inviteError) {
        throw new Error(
          inviteError.code === '23505' ? 'invite_exists' : 'invite_failed',
        );
      }

      if ((insertedInvites ?? []).length > 0) {
        const inviteIds = insertedInvites ?? [];
        const inviteIdsByGroupInviteId = new Map<string, string>();

        await admin
          .schema('public')
          .from('invitations')
          .update({ source: 'onboarding', session_id: null })
          .in(
            'group_invite_id',
            inviteIds.map((invite) => invite.id),
          );

        const { data: unifiedInvitations } = await admin
          .schema('public')
          .from('invitations')
          .select('id, group_invite_id')
          .in(
            'group_invite_id',
            inviteIds.map((invite) => invite.id),
          );

        for (const invitation of unifiedInvitations ?? []) {
          inviteIdsByGroupInviteId.set(
            invitation.group_invite_id,
            invitation.id,
          );
        }

        if (hasEmailEnv()) {
          const sendResults = await Promise.all(
            existingUsersByEmail.map(async (entry) => {
              const insertedInvite = inviteIds.find(
                (invite) =>
                  normalizeEmail(invite.invitee_email) === entry.email,
              );

              if (!insertedInvite) {
                return false;
              }

              const result = await sendGroupInviteEmail({
                locale: studyLanguage,
                inviteId:
                  inviteIdsByGroupInviteId.get(insertedInvite.id) ??
                  insertedInvite.id,
                groupId: groupId!,
                groupName,
                inviteCode,
                inviteeEmail: entry.email,
                inviteeExists: Boolean(entry.userId),
                inviterUserId: founderUserId,
                inviterName: draft.displayName,
              });

              return result.ok;
            }),
          );

          emailWarning = sendResults.some((ok) => !ok);
        }
      }
    }

    await logAppEvent({
      eventName: APP_EVENTS.groupCreated,
      locale: studyLanguage,
      userId: founderUserId,
      groupId,
      metadata: {
        source: 'landing_group_setup',
        exam_session: examSession,
        invite_count: filteredInviteEmails.length,
        skipped_invites: skipInvites,
      },
      useAdmin: true,
    });

    const { error: markUsedError } = await admin
      .schema('public')
      .from('landing_onboarding_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('used_at', null);

    if (markUsedError) {
      throw new Error('token_mark_used_failed');
    }

    revalidatePath(`/${studyLanguage}/dashboard`);
    revalidatePath(`/${studyLanguage}/groups`);

    return { ok: true, groupId, emailWarning };
  } catch (error) {
    if (groupId) {
      await admin
        .schema('public')
        .from('group_invites')
        .delete()
        .eq('group_id', groupId);
      await admin
        .schema('public')
        .from('group_members')
        .delete()
        .eq('group_id', groupId);
      await admin.schema('public').from('groups').delete().eq('id', groupId);
    }

    if (error instanceof Error && error.message === 'invite_exists') {
      return { ok: false, reason: 'invite_exists' };
    }

    return { ok: false, reason: 'unexpected_error' };
  }
}
