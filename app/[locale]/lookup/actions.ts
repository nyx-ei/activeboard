'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { requireUserTierCapability } from '@/lib/billing/gating';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withFeedback } from '@/lib/utils';

type JoinableGroupLookup = {
  id: string;
  member_count: number;
  max_members: number;
};

export async function joinLookupGroupAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const code =
    (formData.get('inviteCode') as string | null)?.trim().toUpperCase() ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const lookupPath = `/${locale}/lookup`;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canBrowseLookupLayer',
    locale,
    redirectTo: `/${locale}/billing`,
  });

  if (!code) {
    redirect(withFeedback(lookupPath, 'error', t('invalidCode')));
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

  const group = matchedGroups?.[0] ?? null;

  if (joinLookupError || !group) {
    redirect(withFeedback(lookupPath, 'error', t('invalidCode')));
  }

  const { data: existingMembership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    redirect(
      withFeedback(
        `/${locale}/dashboard?groupId=${encodeURIComponent(group.id)}`,
        'success',
        t('groupJoined'),
      ),
    );
  }

  if (group.member_count >= group.max_members) {
    redirect(withFeedback(lookupPath, 'error', t('groupFull')));
  }

  const { error } = await supabase
    .schema('public')
    .from('group_members')
    .insert({
      group_id: group.id,
      is_founder: false,
      user_id: user.id,
    });

  if (error) {
    redirect(withFeedback(lookupPath, 'error', t('actionFailed')));
  }

  await logAppEvent({
    eventName: APP_EVENTS.groupJoined,
    locale,
    userId: user.id,
    groupId: group.id,
    metadata: {
      join_method: 'lookup_layer',
      invite_code: code,
    },
  });

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/lookup`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(
    withFeedback(
      `/${locale}/dashboard?groupId=${encodeURIComponent(group.id)}`,
      'success',
      t('groupJoined'),
    ),
  );
}
