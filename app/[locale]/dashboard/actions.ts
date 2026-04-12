'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { requireUserTierCapability } from '@/lib/billing/gating';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { parseAvailabilityGrid } from '@/lib/schedule/availability';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode, generateSessionShareCode, normalizeEmail, withFeedback } from '@/lib/utils';

async function getCurrentAuthUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

type JoinableGroupLookup = {
  id: string;
  member_count: number;
  max_members: number;
};

async function requireDashboardGroupMembership(groupId: string, locale: AppLocale) {
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'error', t('notAuthorized')));
  }

  return { supabase, user, t };
}

export async function joinSessionByCodeAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const code = (formData.get('sessionCode') as string | null)?.trim().toUpperCase() ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canJoinSessions',
    locale,
    redirectTo: `/${locale}/dashboard`,
  });

  if (!code) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('invalidSessionCode')));
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id')
    .eq('share_code', code)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('invalidSessionCode')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.sessionJoinedByCode,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId: session.id,
    metadata: {
      join_method: 'share_code',
      share_code: code,
    },
  });

  redirect(`/${locale}/sessions/${session.id}`);
}

export async function createGroupAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupName = (formData.get('groupName') as string | null)?.trim() ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });

  if (!groupName) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('missingFields')));
  }

  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canBeCaptain',
    locale,
    redirectTo: `/${locale}/dashboard`,
    feedbackKey: 'upgradeRequiredToCreateGroup',
  });

  let inviteCode = generateInviteCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existing } = await supabase
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (!existing) {
      break;
    }

    inviteCode = generateInviteCode();
  }

  const { data: group, error } = await supabase
    .schema('public')
    .from('groups')
    .insert({
      name: groupName,
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !group) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('actionFailed')));
  }

  await supabase.schema('public').from('group_members').insert({
    group_id: group.id,
    is_founder: true,
    user_id: user.id,
  });

  await logAppEvent({
    eventName: APP_EVENTS.groupCreated,
    locale,
    userId: user.id,
    groupId: group.id,
    metadata: {
      group_name: groupName,
      invite_code: inviteCode,
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard`, 'success', t('groupCreated')));
}

export async function joinGroupAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const code = (formData.get('inviteCode') as string | null)?.trim().toUpperCase() ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });

  if (!code) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('invalidCode')));
  }

  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: matchedGroups, error: joinLookupError } = await (
    supabase as typeof supabase & {
      rpc: (
        fn: 'find_group_by_invite_code',
        args: { target_invite_code: string },
      ) => Promise<{
        data: JoinableGroupLookup[] | null;
        error: { message: string } | null;
      }>;
    }
  ).rpc('find_group_by_invite_code', { target_invite_code: code });

  const group: JoinableGroupLookup | null = matchedGroups?.[0] ?? null;

  if (joinLookupError || !group) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('invalidCode')));
  }

  const { data: existingMembership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    redirect(withFeedback(`/${locale}/dashboard`, 'success', t('groupJoined')));
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canJoinMultipleGroups',
    locale,
    redirectTo: `/${locale}/dashboard`,
  });

  if (group.member_count >= group.max_members) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('groupFull')));
  }

  const { error } = await supabase.schema('public').from('group_members').insert({
    group_id: group.id,
    is_founder: false,
    user_id: user.id,
  });

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupJoined,
    locale,
    userId: user.id,
    groupId: group.id,
    metadata: {
      join_method: 'invite_code',
      invite_code: code,
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard`, 'success', t('groupJoined')));
}

export async function respondToInviteAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const inviteId = formData.get('inviteId') as string;
  const intent = formData.get('intent') as 'accept' | 'decline';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: invite } = await supabase
    .schema('public')
    .from('group_invites')
    .select('id, group_id, status')
    .eq('id', inviteId)
    .maybeSingle();

  if (!invite || invite.status !== 'pending') {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }

  if (intent === 'accept') {
    await requireUserTierCapability({
      userId: user.id,
      capability: 'canJoinMultipleGroups',
      locale,
      redirectTo: `/${locale}/dashboard`,
    });

    const { data: members } = await supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('group_id', invite.group_id);

    if ((members?.length ?? 0) >= 5) {
      redirect(withFeedback(`/${locale}/dashboard`, 'error', t('groupFull')));
    }

    await supabase.schema('public').from('group_members').insert({
      group_id: invite.group_id,
      is_founder: false,
      user_id: user.id,
    });
  }

  await supabase
    .schema('public')
    .from('group_invites')
    .update({
      status: intent === 'accept' ? 'accepted' : 'declined',
      invitee_user_id: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', inviteId);

  await logAppEvent({
    eventName: intent === 'accept' ? APP_EVENTS.groupInviteAccepted : APP_EVENTS.groupInviteDeclined,
    locale,
    userId: user.id,
    groupId: invite.group_id,
    metadata: {
      invite_id: invite.id,
      intent,
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(
    withFeedback(
      `/${locale}/dashboard`,
      'success',
      intent === 'accept' ? t('inviteAccepted') : t('inviteDeclined'),
    ),
  );
}

export async function createDashboardSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = (formData.get('groupId') as string | null) ?? '';
  const sessionName = ((formData.get('sessionName') as string | null) ?? '').trim();
  const questionGoal = Number(formData.get('questionGoal'));
  const timerMode = formData.get('timerMode') === 'global' ? 'global' : 'per_question';
  const timerSeconds = Number(formData.get('timerSeconds'));
  const t = await getTranslations({ locale, namespace: 'Feedback' });

  if (
    !groupId ||
    !sessionName ||
    !Number.isFinite(questionGoal) ||
    questionGoal < 1 ||
    !Number.isFinite(timerSeconds) ||
    timerSeconds < 1 ||
    timerSeconds > 3600
  ) {
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'error', t('missingFields')));
  }

  const { supabase, user } = await requireDashboardGroupMembership(groupId, locale);

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canCreateSession',
    locale,
    redirectTo: `/${locale}/dashboard?view=sessions`,
    feedbackKey: 'upgradeRequiredToScheduleSession',
  });

  const { data: existingOpenSession } = await supabase
    .schema('public')
    .from('sessions')
    .select('id')
    .eq('group_id', groupId)
    .eq('name', sessionName)
    .in('status', ['scheduled', 'active', 'incomplete'])
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingOpenSession) {
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'success', t('sessionScheduled')));
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

  const { data: createdSession, error } = await supabase.schema('public').from('sessions').insert({
    group_id: groupId,
    name: sessionName,
    scheduled_at: new Date().toISOString(),
    share_code: shareCode,
    timer_mode: timerMode,
    timer_seconds: timerSeconds,
    question_goal: Math.min(Math.round(questionGoal), 500),
    created_by: user.id,
    leader_id: user.id,
    status: 'scheduled',
  }).select('id').single();

  if (error || !createdSession) {
    console.error('createDashboardSessionAction failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      groupId,
      timerMode,
      timerSeconds,
      questionGoal,
    });
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.sessionScheduled,
    locale,
    userId: user.id,
    groupId,
    sessionId: createdSession.id,
    metadata: {
      source: 'dashboard_sessions_modal',
      session_name: sessionName,
      question_goal: questionGoal,
      timer_seconds: timerSeconds,
      timer_mode: timerMode,
      share_code: shareCode,
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'success', t('sessionScheduled')));
}

export async function cancelDashboardSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = (formData.get('sessionId') as string | null) ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, leader_id, created_by, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.status === 'completed' || session.status === 'cancelled') {
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'error', t('actionFailed')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (session.leader_id !== user.id && session.created_by !== user.id && !membership.is_founder)) {
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'error', t('notAuthorized')));
  }

  const { error } = await supabase.schema('public').from('sessions').update({ status: 'cancelled' }).eq('id', sessionId);

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.sessionEnded,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      source: 'dashboard_session_delete_icon',
      previous_status: session.status,
      new_status: 'cancelled',
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=sessions`, 'success', t('actionSucceeded')));
}

async function requireFounderDashboardMembership(groupId: string, locale: AppLocale) {
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership?.is_founder) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('notAuthorized')));
  }

  return { supabase, user, t };
}

export async function updateUserScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const timezone = ((formData.get('timezone') as string | null) ?? '').trim() || 'UTC';
  const availabilityGridRaw = (formData.get('availabilityGrid') as string | null) ?? '{}';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const availabilityGrid = parseAvailabilityGrid(availabilityGridRaw);

  const { error } = await supabase.schema('public').from('user_schedules').upsert({
    user_id: user.id,
    timezone,
    availability_grid: availabilityGrid,
  });

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.userScheduleUpdated,
    locale,
    userId: user.id,
    metadata: {
      timezone,
      availability_slot_count: Object.values(availabilityGrid).reduce((sum, hours) => sum + hours.length, 0),
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard`, 'success', t('actionSucceeded')));
}

export async function updateDashboardGroupNameAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const groupName = ((formData.get('groupName') as string | null) ?? '').trim();
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);

  if (!groupId || !groupName) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('groups').update({ name: groupName }).eq('id', groupId);

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'success', t('actionSucceeded')));
}

export async function inviteDashboardGroupMemberAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const email = normalizeEmail((formData.get('email') as string | null) ?? '');
  const { supabase, user, t } = await requireFounderDashboardMembership(groupId, locale);

  if (!groupId || !email) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('missingFields')));
  }

  if (email === normalizeEmail(user.email ?? '')) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('cannotInviteSelf')));
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
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('inviteExists')));
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
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('actionFailed')));
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

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'success', t('inviteSent')));
}

export async function addDashboardWeeklyScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const weekdays = formData.getAll('weekday').map(String);
  const startTimes = formData.getAll('startTime').map(String);
  const endTimes = formData.getAll('endTime').map(String);
  const questionGoals = formData.getAll('questionGoal').map((value) => Number(value));
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);

  const schedules: Array<{
    group_id: string;
    weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    start_time: string;
    end_time: string;
    question_goal: number;
  }> = [];

  weekdays.forEach((weekday, index) => {
    const startTime = startTimes[index];
    const endTime = endTimes[index];
    const questionGoal = questionGoals[index];

    if (!weekday || !startTime || !endTime || !questionGoal || questionGoal <= 0) {
      return;
    }

    schedules.push({
      group_id: groupId,
      weekday: weekday as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
      start_time: startTime,
      end_time: endTime,
      question_goal: questionGoal,
    });
  });

  if (!groupId || schedules.length === 0 || schedules.length !== weekdays.length) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('group_weekly_schedules').insert(schedules);

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'success', t('actionSucceeded')));
}

export async function transferDashboardCaptainAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const targetUserId = formData.get('targetUserId') as string;
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  if (!sessionId || !targetUserId || targetUserId === user.id) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('missingFields')));
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || (session.status !== 'active' && session.status !== 'scheduled')) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('actionFailed')));
  }

  if (session.leader_id !== user.id) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('notAuthorized')));
  }

  const { data: targetMembership } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', session.group_id)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetMembership) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('notAuthorized')));
  }

  const { error } = await supabase
    .schema('public')
    .from('sessions')
    .update({ leader_id: targetUserId })
    .eq('id', sessionId);

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.leaderPassed,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      next_leader_id: targetUserId,
      previous_leader_id: session.leader_id,
      source: 'dashboard_settings',
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'success', t('leaderPassed')));
}

export async function deleteDashboardWeeklyScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const scheduleId = formData.get('scheduleId') as string;
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);

  if (!groupId || !scheduleId) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('missingFields')));
  }

  const { error } = await supabase
    .schema('public')
    .from('group_weekly_schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('group_id', groupId);

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(`/${locale}/dashboard?view=settings`, 'success', t('actionSucceeded')));
}
