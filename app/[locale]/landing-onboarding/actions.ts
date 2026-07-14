'use server';

import { createHash, randomBytes } from 'node:crypto';

import type { AppLocale } from '@/i18n/routing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/types';
import { normalizeEmail } from '@/lib/utils';

type FounderExamType = 'mccqe_fr' | 'mccqe_en' | 'usmle' | 'plab' | 'other';
type FounderExamSession =
  | 'april_may_2026'
  | 'august_september_2026'
  | 'october_2026'
  | 'april_may_2027'
  | 'august_september_2027'
  | 'october_2027'
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

type LandingOnboardingStartResult =
  | {
      ok: true;
      email: string;
      token: string;
    }
  | {
      ok: false;
      reason: 'missing_fields' | 'account_exists' | 'action_failed';
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_EXAM_TYPES = new Set<FounderExamType>([
  'mccqe_fr',
  'mccqe_en',
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
  'april_may_2027',
  'august_september_2027',
  'october_2027',
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

function parseDraft(rawDraft: string): FounderOnboardingDraft | null {
  try {
    const draft = JSON.parse(rawDraft) as Partial<FounderOnboardingDraft>;
    const normalizedBanks = [
      ...new Set(
        (draft.questionBanks ?? []).filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ),
      ),
    ];
    const normalizedMembers = [
      ...new Set(
        (draft.memberEmails ?? [])
          .map((email) => normalizeEmail(email ?? ''))
          .filter(Boolean),
      ),
    ];
    const rawExamType =
      typeof draft.examType === 'string' ? (draft.examType as string) : '';
    const normalizedExamType =
      rawExamType === 'mccqe1' ? 'mccqe_en' : rawExamType;
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
      !VALID_EXAM_TYPES.has(normalizedExamType as FounderExamType) ||
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
      examType: normalizedExamType as FounderExamType,
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

function createPasswordSetupToken() {
  return randomBytes(32).toString('base64url');
}

function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function startLandingOnboardingAction(
  formData: FormData,
): Promise<LandingOnboardingStartResult> {
  const startedAt = performance.now();
  const rawDraft = ((formData.get('draft') as string | null) ?? '').trim();
  const draft = parseDraft(rawDraft);

  if (!draft) {
    return { ok: false, reason: 'missing_fields' };
  }

  const founderEmail = draft.email;

  if (
    !draft.displayName ||
    !founderEmail ||
    !EMAIL_PATTERN.test(founderEmail) ||
    !draft.groupName ||
    draft.questionBanks.length === 0
  ) {
    return { ok: false, reason: 'missing_fields' };
  }

  const token = createPasswordSetupToken();
  const adminClient = createSupabaseAdminClient();
  const { data: existingUser, error: existingUserError } = await adminClient
    .schema('public')
    .from('users')
    .select('id')
    .eq('email', founderEmail)
    .maybeSingle();

  if (existingUserError) {
    return { ok: false, reason: 'action_failed' };
  }

  if (existingUser) {
    return { ok: false, reason: 'account_exists' };
  }

  const { error: tokenError } = await adminClient
    .schema('public')
    .from('landing_onboarding_tokens')
    .insert({
      token_hash: hashPasswordSetupToken(token),
      email: founderEmail,
      draft: draft as unknown as Json,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

  if (tokenError) {
    return { ok: false, reason: 'action_failed' };
  }

  console.info('[perf] startLandingOnboardingAction:done', {
    elapsedMs: Math.round(performance.now() - startedAt),
  });

  return {
    ok: true,
    email: founderEmail,
    token,
  };
}
