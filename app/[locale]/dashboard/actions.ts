'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { requireUserTierCapability } from '@/lib/billing/gating';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendSessionCalendarInvites } from '@/lib/notifications/calendar-invites';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { parseAvailabilityGrid } from '@/lib/schedule/availability';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode, generateSessionShareCode, normalizeEmail, withFeedback } from '@/lib/utils';

async function getCurrentAuthUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

function withSessionJoinFeedback(path: string, tone: 'success' | 'error', message: string) {
  const url = new URL(withFeedback(path, tone, message), 'http://localhost');
  url.searchParams.set('sessionJoinFeedback', '1');
  return `${url.pathname}?${url.searchParams.toString()}`;
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
  const sessionsPath = `/${locale}/dashboard?view=sessions`;

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canJoinSessions',
    locale,
    redirectTo: sessionsPath,
  });

  if (!code) {
    redirect(withSessionJoinFeedback(sessionsPath, 'error', t('invalidSessionCode')));
  }

  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select('id, group_id, status')
    .eq('share_code', code)
    .maybeSingle();

  if (!session) {
    redirect(withSessionJoinFeedback(sessionsPath, 'error', t('invalidSessionCode')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect(withSessionJoinFeedback(sessionsPath, 'error', t('notAuthorized')));
  }

  if (session.status === 'completed') {
    redirect(withSessionJoinFeedback(sessionsPath, 'error', t('sessionCompletedHint')));
  }

  if (session.status === 'cancelled' || session.status === 'incomplete') {
    redirect(withSessionJoinFeedback(sessionsPath, 'error', t('sessionInactive')));
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
    capability: 'canBrowseLookupLayer',
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
  const redirectTo = ((formData.get('redirectTo') as string | null) ?? '').trim();
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();
  const safeRedirectTo = redirectTo.startsWith(`/${locale}/`) ? redirectTo : `/${locale}/dashboard`;

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
    redirect(withFeedback(safeRedirectTo, 'error', t('notAuthorized')));
  }

  if (intent === 'accept') {
    await requireUserTierCapability({
      userId: user.id,
      capability: 'canJoinMultipleGroups',
      locale,
      redirectTo: safeRedirectTo,
    });

    const { data: members } = await supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('group_id', invite.group_id);

    if ((members?.length ?? 0) >= 5) {
      redirect(withFeedback(safeRedirectTo, 'error', t('groupFull')));
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
  revalidatePath(safeRedirectTo);
  redirect(
    withFeedback(
      safeRedirectTo,
      'success',
      intent === 'accept' ? t('inviteAccepted') : t('inviteDeclined'),
    ),
  );
}

export async function completeInviteOnboardingAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const inviteId = ((formData.get('inviteId') as string | null) ?? '').trim();
  const redirectTo = ((formData.get('redirectTo') as string | null) ?? '').trim();
  const examSession = ((formData.get('examSession') as string | null) ?? '').trim();
  const language = formData.get('language') === 'fr' ? 'fr' : 'en';
  const timezone = ((formData.get('timezone') as string | null) ?? '').trim() || 'UTC';
  const availabilityGridRaw = (formData.get('availabilityGrid') as string | null) ?? '{}';
  const questionBanks = [...new Set(formData.getAll('questionBanks').map((value) => String(value).trim()).filter(Boolean))];
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();
  const safeRedirectTo = redirectTo.startsWith(`/${locale}/`) ? redirectTo : `/${locale}/dashboard`;

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  if (!inviteId || !examSession) {
    redirect(withFeedback(safeRedirectTo, 'error', t('missingFields')));
  }

  const { data: invite } = await supabase
    .schema('public')
    .from('group_invites')
    .select('id, group_id, invitee_email, status')
    .eq('id', inviteId)
    .maybeSingle();

  if (!invite || invite.status !== 'pending') {
    redirect(withFeedback(safeRedirectTo, 'error', t('notAuthorized')));
  }

  if (normalizeEmail(invite.invitee_email) !== normalizeEmail(user.email ?? '')) {
    redirect(withFeedback(safeRedirectTo, 'error', t('notAuthorized')));
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canJoinMultipleGroups',
    locale,
    redirectTo: safeRedirectTo,
  });

  const availabilityGrid = parseAvailabilityGrid(availabilityGridRaw);

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      exam_session: examSession,
      question_banks: questionBanks,
      locale: language,
    },
  });

  if (authError) {
    redirect(withFeedback(safeRedirectTo, 'error', t('actionFailed')));
  }

  const { error: userProfileError } = await supabase
    .schema('public')
    .from('users')
    .update({
      exam_session: examSession as 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead',
      question_banks: questionBanks,
      locale: language,
    })
    .eq('id', user.id);

  if (userProfileError) {
    redirect(withFeedback(safeRedirectTo, 'error', t('actionFailed')));
  }

  const { error: scheduleError } = await supabase.schema('public').from('user_schedules').upsert({
    user_id: user.id,
    timezone,
    availability_grid: availabilityGrid,
  });

  if (scheduleError) {
    redirect(withFeedback(safeRedirectTo, 'error', t('actionFailed')));
  }

  const { data: existingMembership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', invite.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingMembership) {
    const { data: members } = await supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('group_id', invite.group_id);

    if ((members?.length ?? 0) >= 5) {
      redirect(withFeedback(safeRedirectTo, 'error', t('groupFull')));
    }

    const { error: membershipError } = await supabase.schema('public').from('group_members').insert({
      group_id: invite.group_id,
      is_founder: false,
      user_id: user.id,
    });

    if (membershipError) {
      redirect(withFeedback(safeRedirectTo, 'error', t('actionFailed')));
    }
  }

  const { error: inviteUpdateError } = await supabase
    .schema('public')
    .from('group_invites')
    .update({
      status: 'accepted',
      invitee_user_id: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', inviteId);

  if (inviteUpdateError) {
    redirect(withFeedback(safeRedirectTo, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupInviteAccepted,
    locale,
    userId: user.id,
    groupId: invite.group_id,
    metadata: {
      invite_id: invite.id,
      source: 'invite_onboarding_wizard',
      exam_session: examSession,
      locale_selected: language,
      timezone,
      question_banks: questionBanks,
      availability_slot_count: Object.values(availabilityGrid).reduce((sum, hours) => sum + hours.length, 0),
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/groups/${invite.group_id}`);
  revalidatePath(safeRedirectTo);
  redirect(withFeedback(safeRedirectTo, 'success', t('inviteAccepted')));
}

export async function createDashboardSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = (formData.get('groupId') as string | null) ?? '';
  const returnTo = (formData.get('returnTo') as string | null) ?? '';
  const sessionName = ((formData.get('sessionName') as string | null) ?? '').trim();
  const questionGoal = Number(formData.get('questionGoal'));
  const timerMode = formData.get('timerMode') === 'global' ? 'global' : 'per_question';
  const timerSeconds = Number(formData.get('timerSeconds'));
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const sessionsPath =
    groupId && returnTo === groupDashboardPath(locale, groupId)
      ? returnTo
      : `/${locale}/dashboard?view=sessions`;

  if (
    !groupId ||
    !sessionName ||
    !Number.isFinite(questionGoal) ||
    questionGoal < 1 ||
    !Number.isFinite(timerSeconds) ||
    timerSeconds < 1 ||
    timerSeconds > 3600
  ) {
    redirect(withFeedback(sessionsPath, 'error', t('missingFields')));
  }

  const { supabase, user } = await requireDashboardGroupMembership(groupId, locale);
  const { data: members } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  if ((members?.length ?? 0) < 2) {
    redirect(withFeedback(sessionsPath, 'error', t('minimumMembersRequired')));
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canCreateSession',
    locale,
    redirectTo: sessionsPath,
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
    redirect(withFeedback(`/${locale}/sessions/${existingOpenSession.id}`, 'success', t('sessionScheduled')));
  }

  let shareCode = generateSessionShareCode();
  const scheduledAt = new Date().toISOString();

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
    scheduled_at: scheduledAt,
    share_code: shareCode,
    timer_mode: timerMode,
    timer_seconds: timerSeconds,
    question_goal: Math.min(Math.round(questionGoal), 500),
    created_by: user.id,
    leader_id: user.id,
    status: 'scheduled',
  }).select('id, group_id, name, scheduled_at, share_code, meeting_link, timer_seconds').single();

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
    redirect(withFeedback(sessionsPath, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.sessionScheduled,
    locale,
    userId: user.id,
    groupId,
    sessionId: createdSession.id,
    metadata: {
      source: sessionsPath === groupDashboardPath(locale, groupId) ? 'group_page_session_modal' : 'dashboard_sessions_modal',
      session_name: sessionName,
      question_goal: questionGoal,
      timer_seconds: timerSeconds,
      timer_mode: timerMode,
      share_code: shareCode,
    },
  });

  if (hasEmailEnv()) {
    try {
      await sendSessionCalendarInvites(createdSession);
    } catch (inviteError) {
      console.error('sendSessionCalendarInvites failed', {
        sessionId: createdSession.id,
        groupId,
        error: inviteError instanceof Error ? inviteError.message : 'Unknown calendar invite error',
      });
    }
  }

  redirect(withFeedback(`/${locale}/sessions/${createdSession.id}`, 'success', t('sessionScheduled')));
}

export const createGroupSessionAction = createDashboardSessionAction;

export async function cancelDashboardSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = (formData.get('sessionId') as string | null) ?? '';
  const returnTo = (formData.get('returnTo') as string | null) ?? '';
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
  const sessionReturnPath =
    session && returnTo === groupDashboardPath(locale, session.group_id)
      ? returnTo
      : `/${locale}/dashboard?view=sessions`;

  if (!session) {
    redirect(withFeedback(sessionReturnPath, 'error', t('actionFailed')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (session.leader_id !== user.id && session.created_by !== user.id && !membership.is_founder)) {
    redirect(withFeedback(sessionReturnPath, 'error', t('deleteSessionNotAuthorized')));
  }

  const { error } = await supabase.schema('public').from('sessions').update({ status: 'cancelled' }).eq('id', sessionId);

  if (error) {
    redirect(withFeedback(sessionReturnPath, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.sessionEnded,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      source: sessionReturnPath === groupDashboardPath(locale, session.group_id) ? 'group_page_session_delete_icon' : 'dashboard_session_delete_icon',
      previous_status: session.status,
      new_status: 'cancelled',
    },
  });

  redirect(withFeedback(sessionReturnPath, 'success', t('actionSucceeded')));
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
    redirect(withFeedback(`/${locale}/groups`, 'error', t('notAuthorized')));
  }

  return { supabase, user, t };
}

function groupDashboardPath(locale: AppLocale, groupId: string) {
  return `/${locale}/groups/${groupId}`;
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
  const settingsPath = groupDashboardPath(locale, groupId);

  if (!groupId || !groupName) {
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('groups').update({ name: groupName }).eq('id', groupId);

  if (error) {
    redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(settingsPath, 'success', t('actionSucceeded')));
}

function isValidMeetingLink(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname.includes('zoom.us') || url.hostname.includes('meet.google.com') || url.hostname.includes('teams.microsoft.com'))
    );
  } catch {
    return false;
  }
}

export async function updateDashboardGroupDetailsAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const groupName = ((formData.get('groupName') as string | null) ?? '').trim();
  const meetingLink = ((formData.get('meetingLink') as string | null) ?? '').trim();
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);
  const settingsPath = groupDashboardPath(locale, groupId);

  if (!groupId || !groupName || !isValidMeetingLink(meetingLink)) {
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  const { error } = await supabase
    .schema('public')
    .from('groups')
    .update({
      name: groupName,
      meeting_link: meetingLink,
    })
    .eq('id', groupId);

  if (error) {
    redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(settingsPath, 'success', t('actionSucceeded')));
}

export async function updateDashboardGroupMeetingLinkAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const meetingLink = ((formData.get('meetingLink') as string | null) ?? '').trim();
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);

  if (!groupId || !isValidMeetingLink(meetingLink)) {
    redirect(withFeedback(groupDashboardPath(locale, groupId), 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('groups').update({ meeting_link: meetingLink }).eq('id', groupId);

  if (error) {
    redirect(withFeedback(groupDashboardPath(locale, groupId), 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(groupDashboardPath(locale, groupId), 'success', t('actionSucceeded')));
}

export async function inviteDashboardGroupMemberAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const email = normalizeEmail((formData.get('email') as string | null) ?? '');
  const { supabase, user, t } = await requireFounderDashboardMembership(groupId, locale);
  const settingsPath = groupDashboardPath(locale, groupId);

  if (!groupId || !email) {
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  if (email === normalizeEmail(user.email ?? '')) {
    redirect(withFeedback(settingsPath, 'error', t('cannotInviteSelf')));
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
    redirect(withFeedback(settingsPath, 'error', t('inviteExists')));
  }

  const { data: existingUser } = await supabase
    .schema('public')
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  const { data: insertedInvite, error } = await supabase
    .schema('public')
    .from('group_invites')
    .insert({
      group_id: groupId,
      invited_by: user.id,
      invitee_email: email,
      invitee_user_id: existingUser?.id ?? null,
    })
    .select('id')
    .single();

  if (error) {
    redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
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

  if (!hasEmailEnv()) {
    revalidatePath(`/${locale}/dashboard`);
    redirect(withFeedback(settingsPath, 'error', t('inviteCreatedEmailFailed')));
  }

  if (hasEmailEnv()) {
    const [{ data: group }, { data: inviter }] = await Promise.all([
      supabase.schema('public').from('groups').select('name, invite_code').eq('id', groupId).maybeSingle(),
      supabase.schema('public').from('users').select('display_name, email').eq('id', user.id).maybeSingle(),
    ]);

    const inviteEmailResult = await sendGroupInviteEmail({
      locale,
      inviteId: insertedInvite?.id ?? '',
      groupId,
      groupName: group?.name ?? 'ActiveBoard',
      inviteCode: group?.invite_code ?? '',
      inviteeEmail: email,
      inviterUserId: user.id,
      inviterName: inviter?.display_name ?? inviter?.email ?? user.email ?? 'ActiveBoard',
    });

    if (!inviteEmailResult.ok) {
      redirect(withFeedback(settingsPath, 'error', t('inviteCreatedEmailFailed')));
    }
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(settingsPath, 'success', t('inviteSent')));
}

export async function addDashboardExistingMemberAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const email = normalizeEmail((formData.get('email') as string | null) ?? '');
  const { supabase, user, t } = await requireFounderDashboardMembership(groupId, locale);
  const groupPath = groupDashboardPath(locale, groupId);

  if (!groupId || !email) {
    redirect(withFeedback(groupPath, 'error', t('missingFields')));
  }

  const { data: group } = await supabase
    .schema('public')
    .from('groups')
    .select('id, name, invite_code, max_members')
    .eq('id', groupId)
    .maybeSingle();

  if (!group) {
    redirect(withFeedback(groupPath, 'error', t('notAuthorized')));
  }

  const [{ data: existingUser }, { data: members }, { data: existingInvite }] = await Promise.all([
    supabase.schema('public').from('users').select('id, email, display_name').eq('email', email).maybeSingle(),
    supabase.schema('public').from('group_members').select('user_id').eq('group_id', groupId),
    supabase
      .schema('public')
      .from('group_invites')
      .select('id')
      .eq('group_id', groupId)
      .eq('invitee_email', email)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);

  if (!existingUser) {
    redirect(withFeedback(groupPath, 'error', t('userNotFound')));
  }

  if ((members ?? []).some((member) => member.user_id === existingUser.id)) {
    redirect(withFeedback(groupPath, 'success', t('memberAlreadyInGroup')));
  }

  if (existingInvite) {
    redirect(withFeedback(groupPath, 'error', t('inviteExists')));
  }

  if ((members?.length ?? 0) >= group.max_members) {
    redirect(withFeedback(groupPath, 'error', t('groupFull')));
  }

  const { data: insertedInvite, error } = await supabase
    .schema('public')
    .from('group_invites')
    .insert({
      group_id: groupId,
      invited_by: user.id,
      invitee_email: existingUser.email,
      invitee_user_id: existingUser.id,
    })
    .select('id')
    .single();

  if (error) {
    redirect(withFeedback(groupPath, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupInviteSent,
    locale,
    userId: user.id,
    groupId,
    metadata: {
      invitee_email: existingUser.email,
      invitee_user_id: existingUser.id,
      source: 'dashboard_group_tab_existing_user_invite',
    },
  });

  if (hasEmailEnv()) {
    const { data: inviter } = await supabase
      .schema('public')
      .from('users')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const inviteEmailResult = await sendGroupInviteEmail({
      locale,
      inviteId: insertedInvite?.id ?? '',
      groupId,
      groupName: group.name,
      inviteCode: group.invite_code ?? '',
      inviteeEmail: existingUser.email,
      inviterUserId: user.id,
      inviterName: inviter?.display_name ?? inviter?.email ?? user.email ?? 'ActiveBoard',
    });

    if (!inviteEmailResult.ok) {
      redirect(withFeedback(groupPath, 'error', t('inviteCreatedEmailFailed')));
    }
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(groupPath, 'success', t('inviteSent')));
}

export async function addDashboardWeeklyScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const weekdays = formData.getAll('weekday').map(String);
  const startTimes = formData.getAll('startTime').map(String);
  const endTimes = formData.getAll('endTime').map(String);
  const questionGoals = formData.getAll('questionGoal').map((value) => Number(value));
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);
  const settingsPath = groupDashboardPath(locale, groupId);

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
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  const { error } = await supabase.schema('public').from('group_weekly_schedules').insert(schedules);

  if (error) {
    redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(settingsPath, 'success', t('actionSucceeded')));
}

export async function updateDashboardWeeklySchedulesAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const scheduleIds = formData.getAll('scheduleId').map(String);
  const weekdays = formData.getAll('weekday').map(String);
  const startTimes = formData.getAll('startTime').map(String);
  const endTimes = formData.getAll('endTime').map(String);
  const questionGoals = formData.getAll('questionGoal').map((value) => Number(value));
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);
  const settingsPath = groupDashboardPath(locale, groupId);

  if (!groupId || scheduleIds.length === 0) {
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  const updates = scheduleIds.map((scheduleId, index) => ({
    id: scheduleId,
    weekday: weekdays[index] ?? '',
    start_time: startTimes[index] ?? '',
    end_time: endTimes[index] ?? '',
    question_goal: questionGoals[index] ?? Number.NaN,
  }));

  if (
    updates.some(
      (schedule) =>
        !schedule.weekday ||
        !schedule.start_time ||
        !schedule.end_time ||
        !Number.isFinite(schedule.question_goal) ||
        schedule.question_goal <= 0,
    )
  ) {
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  const existingSchedules = updates.filter((schedule) => schedule.id && !schedule.id.startsWith('new-'));
  const newSchedules = updates.filter((schedule) => !schedule.id || schedule.id.startsWith('new-'));

  const results = await Promise.all(
    existingSchedules.map((schedule) =>
      supabase
        .schema('public')
        .from('group_weekly_schedules')
        .update({
          weekday: schedule.weekday as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          question_goal: schedule.question_goal,
        })
        .eq('id', schedule.id)
        .eq('group_id', groupId),
    ),
  );

  if (results.some((result) => result.error)) {
    redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
  }

  if (newSchedules.length > 0) {
    const { error } = await supabase.schema('public').from('group_weekly_schedules').insert(
      newSchedules.map((schedule) => ({
        group_id: groupId,
        weekday: schedule.weekday as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        question_goal: schedule.question_goal,
      })),
    );

    if (error) {
      redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
    }
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(settingsPath, 'success', t('actionSucceeded')));
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
    redirect(withFeedback(`/${locale}/groups`, 'error', t('missingFields')));
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || (session.status !== 'active' && session.status !== 'scheduled')) {
    redirect(withFeedback(`/${locale}/groups`, 'error', t('actionFailed')));
  }

  if (session.leader_id !== user.id) {
    redirect(withFeedback(`/${locale}/groups`, 'error', t('notAuthorized')));
  }

  const { data: targetMembership } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', session.group_id)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetMembership) {
    redirect(withFeedback(`/${locale}/groups`, 'error', t('notAuthorized')));
  }

  const { error } = await supabase
    .schema('public')
    .from('sessions')
    .update({ leader_id: targetUserId })
    .eq('id', sessionId);

  if (error) {
    redirect(withFeedback(`/${locale}/groups`, 'error', t('actionFailed')));
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
  redirect(withFeedback(groupDashboardPath(locale, session.group_id), 'success', t('leaderPassed')));
}

export async function deleteDashboardWeeklyScheduleAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const groupId = formData.get('groupId') as string;
  const scheduleId = (formData.get('deleteScheduleId') ?? formData.get('scheduleId')) as string;
  const { supabase, t } = await requireFounderDashboardMembership(groupId, locale);
  const settingsPath = groupDashboardPath(locale, groupId);

  if (!groupId || !scheduleId) {
    redirect(withFeedback(settingsPath, 'error', t('missingFields')));
  }

  const { error } = await supabase
    .schema('public')
    .from('group_weekly_schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('group_id', groupId);

  if (error) {
    redirect(withFeedback(settingsPath, 'error', t('actionFailed')));
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(withFeedback(settingsPath, 'success', t('actionSucceeded')));
}
