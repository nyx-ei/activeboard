import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function GroupsIndexPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { live?: string };
}) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const supabase = createSupabaseServerClient();
  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.group_id) {
    redirect(`/${locale}/groups/${membership.group_id}${searchParams.live === '1' ? '?live=1' : ''}`);
  }

  redirect(`/${locale}/dashboard?view=sessions`);
}
