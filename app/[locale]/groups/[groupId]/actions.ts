'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateSessionShareCode, normalizeEmail, withFeedback } from '@/lib/utils';

async function getCurrentAuthUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function requireAdminGroupMembership(groupId: string, locale: AppLocale) {
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('notAuthorized')));
  }

  return { supabase, user, t };
}

export async function inviteMemberAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const email = normalizeEmail((formData.get('email') as string | null) ?? '');
  const { supabase, user, t } = await requireAdminGroupMembership(groupId, locale);

  if (!groupId || !email) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('missingFields')));
  }

  if (email === normalizeEmail(user.email ?? '')) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('cannotInviteSelf')));
  }

  const { data: existingInvite } = await supabase
    .schema('public')
    .from('group_invites')
    .select('id')
    .eq('group_id', groupId)
    .eq('invitee_email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingInvite) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('inviteExists')));
  }

  const { data: existingUser } = await supabase
    .schema('public')
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  const { error } = await supabase.schema('public').from('group_invites').insert({
    group_id: groupId,
    invited_by: user.id,
    invitee_email: email,
    invitee_user_id: existingUser?.id ?? null,
  });

  if (error) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupInviteSent,
    locale,
    userId: user.id,
    groupId,
    metadata: {
      invitee_email: email,
      invitee_user_id: existingUser?.id ?? null,
    },
  });

  revalidatePath(`/${locale}/groups/${groupId}`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/groups/${groupId}`, 'success', t('inviteSent')));
}

export async function scheduleSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const sessionName = ((formData.get('sessionName') as string | null) ?? '').trim();
  const date = formData.get('date') as string;
  const time = formData.get('time') as string;
  const timerMode = (formData.get('timerMode') as string | null) === 'global' ? 'global' : 'per_question';
  const timer = Number(formData.get('timerSeconds'));
  const meetingLink = ((formData.get('meetingLink') as string | null) ?? '').trim() || null;
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  if (!groupId || !sessionName || !date || !time || !timer) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('missingFields')));
  }

  const scheduledAt = new Date(`${date}T${time}`);

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('notAuthorized')));
  }

  let shareCode = generateSessionShareCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existingSession } = await supabase
      .schema('public')
      .from('sessions')
      .select('id')
      .eq('share_code', shareCode)
      .maybeSingle();

    if (!existingSession) {
      break;
    }

    shareCode = generateSessionShareCode();
  }

  const { error } = await supabase.schema('public').from('sessions').insert({
    group_id: groupId,
    name: sessionName,
    scheduled_at: scheduledAt.toISOString(),
    share_code: shareCode,
    timer_seconds: timer,
    meeting_link: meetingLink,
    created_by: user.id,
    leader_id: user.id,
    status: 'scheduled',
  });

  if (error) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.sessionScheduled,
    locale,
    userId: user.id,
    groupId,
    metadata: {
      scheduled_at: scheduledAt.toISOString(),
      session_name: sessionName,
      timer_seconds: timer,
      timer_mode: timerMode === 'global' ? 'global' : 'per_question',
      share_code: shareCode,
      has_meeting_link: Boolean(meetingLink),
    },
  });

  revalidatePath(`/${locale}/groups/${groupId}`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/groups/${groupId}`, 'success', t('sessionScheduled')));
}

export async function updateGroupNameAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const groupName = ((formData.get('groupName') as string | null) ?? '').trim();
  const { supabase, t } = await requireAdminGroupMembership(groupId, locale);

  if (!groupName) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('groups').update({ name: groupName }).eq('id', groupId);

  if (error) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/groups/${groupId}`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/groups/${groupId}`);
}

export async function addWeeklyScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const weekday = (formData.get('weekday') as string | null) ?? '';
  const startTime = (formData.get('startTime') as string | null) ?? '';
  const endTime = (formData.get('endTime') as string | null) ?? '';
  const questionGoal = Number(formData.get('questionGoal'));
  const { supabase, t } = await requireAdminGroupMembership(groupId, locale);

  if (!weekday || !startTime || !endTime || !questionGoal) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('group_weekly_schedules').insert({
    group_id: groupId,
    weekday: weekday as
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday',
    start_time: startTime,
    end_time: endTime,
    question_goal: questionGoal,
  });

  if (error) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/groups/${groupId}`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/groups/${groupId}`);
}

export async function deleteWeeklyScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const scheduleId = formData.get('scheduleId') as string;
  const { supabase, t } = await requireAdminGroupMembership(groupId, locale);

  if (!scheduleId) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('missingFields')));
  }

  const { error } = await supabase
    .schema('public')
    .from('group_weekly_schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('group_id', groupId);

  if (error) {
    redirect(withFeedback(`/${locale}/groups/${groupId}`, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/groups/${groupId}`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/groups/${groupId}`);
}
