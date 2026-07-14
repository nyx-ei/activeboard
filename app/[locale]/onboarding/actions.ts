'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';
import {
  AVAILABILITY_WEEKDAYS,
  type AvailabilityGrid,
} from '@/lib/schedule/availability';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const VALID_EXAMS = new Set(['mccqe_fr', 'mccqe_en', 'usmle', 'plab', 'other']);
const VALID_EXAM_SESSIONS = new Set([
  'april_may_2026',
  'august_september_2026',
  'october_2026',
  'planning_ahead',
]);
const VALID_QBANKS = new Set([
  'uworld',
  'canadaqbank',
  'amboss',
  'aceqbank',
  'cmc_prep',
  'other',
]);

const SLOT_TO_HOUR = {
  morning: 9,
  evening: 18,
} as const;

const MIN_AVAILABILITY_SLOTS = 5;

type AvailabilitySlot = keyof typeof SLOT_TO_HOUR;

function getLocale(formData: FormData): AppLocale {
  return (((formData.get('locale') as string | null) ?? 'en') === 'fr'
    ? 'fr'
    : 'en') as AppLocale;
}

function buildDisplayName(userName: string | null, userEmail?: string) {
  const fallback = userEmail?.split('@')[0] ?? 'ActiveBoard';
  return userName?.trim() || fallback;
}

function normalizeExamType(value: string) {
  return value === 'mccqe1' ? 'mccqe_en' : value;
}

function normalizeQuestionBank(value: string) {
  return value === 'cmc' ? 'cmc_prep' : value;
}

function parseAvailabilitySlots(raw: string | null): AvailabilityGrid {
  const grid = AVAILABILITY_WEEKDAYS.reduce((accumulator, weekday) => {
    accumulator[weekday] = [];
    return accumulator;
  }, {} as AvailabilityGrid);

  if (!raw) {
    return grid;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return grid;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return grid;
  }

  for (const weekday of AVAILABILITY_WEEKDAYS) {
    const slots = (parsed as Record<string, unknown>)[weekday];
    if (!Array.isArray(slots)) {
      continue;
    }

    grid[weekday] = slots
      .filter((slot): slot is AvailabilitySlot => slot in SLOT_TO_HOUR)
      .map((slot) => SLOT_TO_HOUR[slot]);
  }

  return grid;
}

function getSlotCount(grid: AvailabilityGrid) {
  return AVAILABILITY_WEEKDAYS.reduce(
    (count, weekday) => count + grid[weekday].length,
    0,
  );
}

export async function completeTrialProfileAction(formData: FormData) {
  const locale = getLocale(formData);
  const user = await requireUser(locale);
  const phoneNumber = ((formData.get('phoneNumber') as string | null) ?? '').trim();
  const examType = normalizeExamType(
    ((formData.get('examType') as string | null) ?? '').trim(),
  );
  const examSession =
    ((formData.get('examSession') as string | null) ?? '').trim() ||
    'planning_ahead';
  const questionBanks = [
    ...new Set(
      formData
        .getAll('qbank')
        .map((value) =>
          normalizeQuestionBank(typeof value === 'string' ? value.trim() : ''),
        )
        .filter(Boolean),
    ),
  ];
  const timezone =
    ((formData.get('timezone') as string | null) ?? '').trim() || 'UTC';
  const displayName = buildDisplayName(
    typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name
      : null,
    user.email,
  );

  if (
    !phoneNumber ||
    !VALID_EXAMS.has(examType) ||
    !VALID_EXAM_SESSIONS.has(examSession)
  ) {
    redirect(`/${locale}/onboarding/profile?error=missing_fields`);
  }

  if (!questionBanks.every((qbank) => VALID_QBANKS.has(qbank))) {
    redirect(`/${locale}/onboarding/profile?error=missing_fields`);
  }

  const supabase = createSupabaseServerClient();
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      full_name: displayName,
      phone_number: phoneNumber,
      exam_type: examType,
      exam_session: examSession,
      question_banks: questionBanks,
      timezone,
    },
  });

  if (authError) {
    redirect(`/${locale}/onboarding/profile?error=save_failed`);
  }

  const { error: profileError } = await supabase.schema('public').from('users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      display_name: displayName,
      phone_number: phoneNumber,
      exam_type: examType as 'mccqe_fr' | 'mccqe_en' | 'usmle' | 'plab' | 'other',
      exam_session: examSession as
        | 'april_may_2026'
        | 'august_september_2026'
        | 'october_2026'
        | 'planning_ahead',
      question_banks: questionBanks,
      locale,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    redirect(`/${locale}/onboarding/profile?error=save_failed`);
  }

  const { error: scheduleError } = await supabase
    .schema('public')
    .from('user_schedules')
    .upsert(
      {
        user_id: user.id,
        timezone,
      },
      { onConflict: 'user_id' },
    );

  if (scheduleError) {
    redirect(`/${locale}/onboarding/profile?error=save_failed`);
  }

  revalidatePath(`/${locale}/onboarding/profile`);
  redirect(`/${locale}/onboarding/availability`);
}

export async function completeTrialAvailabilityAction(formData: FormData) {
  const locale = getLocale(formData);
  const user = await requireUser(locale);
  const isEditMode = formData.get('mode') === 'edit';
  const availabilityPath = `/${locale}/onboarding/availability${
    isEditMode ? '?mode=edit' : ''
  }`;
  const availabilityErrorPath = (error: string) =>
    `${availabilityPath}${availabilityPath.includes('?') ? '&' : '?'}error=${error}`;
  const understood = formData.get('understood') === 'on';
  const timezone =
    ((formData.get('timezone') as string | null) ?? '').trim() || 'UTC';
  const grid = parseAvailabilitySlots(
    (formData.get('availabilitySlots') as string | null) ?? null,
  );

  if (!understood || getSlotCount(grid) < MIN_AVAILABILITY_SLOTS) {
    redirect(availabilityErrorPath('minimum_slots'));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.schema('public').from('user_schedules').upsert(
    {
      user_id: user.id,
      timezone,
      availability_grid: grid,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    redirect(availabilityErrorPath('save_failed'));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/dashboard`);
}
