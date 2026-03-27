'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
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
    user_id: user.id,
    role: 'admin',
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

  if (group.member_count >= group.max_members) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('groupFull')));
  }

  const { error } = await supabase.schema('public').from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'member',
  });

  if (error) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('actionFailed')));
  }

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
      user_id: user.id,
      role: 'member',
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

  revalidatePath(`/${locale}/dashboard`);
  redirect(
    withFeedback(
      `/${locale}/dashboard`,
      'success',
      intent === 'accept' ? t('inviteAccepted') : t('inviteDeclined'),
    ),
  );
}
