'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { requireUserTierCapability } from '@/lib/billing/gating';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode, withFeedback } from '@/lib/utils';

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
