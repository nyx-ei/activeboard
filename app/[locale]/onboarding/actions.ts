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

const VALID_EXAMS = new Set(['mccqe1', 'usmle', 'plab', 'other']);
const VALID_QBANKS = new Set([
  '',
  'uworld',
  'canadaqbank',
  'amboss',
  'aceqbank',
  'cmc',
  'other',
]);

const SLOT_TO_HOUR = {
  morning: 9,
  evening: 18,
} as const;

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
  const examType = ((formData.get('examType') as string | null) ?? '').trim();
  const qbank = ((formData.get('qbank') as string | null) ?? '').trim();
  const timezone =
    ((formData.get('timezone') as string | null) ?? '').trim() || 'UTC';
  const displayName = buildDisplayName(
    typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name
      : null,
    user.email,
  );

  if (!phoneNumber || !VALID_EXAMS.has(examType)) {
    redirect(`/${locale}/onboarding/profile?error=missing_fields`);
  }

  if (!VALID_QBANKS.has(qbank)) {
    redirect(`/${locale}/onboarding/profile?error=missing_fields`);
  }

  const supabase = createSupabaseServerClient();
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      full_name: displayName,
      phone_number: phoneNumber,
      exam_type: examType,
      question_banks: qbank ? [qbank] : [],
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
      exam_type: examType as 'mccqe1' | 'usmle' | 'plab' | 'other',
      question_banks: qbank ? [qbank] : [],
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
  const understood = formData.get('understood') === 'on';
  const timezone =
    ((formData.get('timezone') as string | null) ?? '').trim() || 'UTC';
  const grid = parseAvailabilitySlots(
    (formData.get('availabilitySlots') as string | null) ?? null,
  );

  if (!understood || getSlotCount(grid) < 5) {
    redirect(`/${locale}/onboarding/availability?error=minimum_slots`);
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
    redirect(`/${locale}/onboarding/availability?error=save_failed`);
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/dashboard`);
}
