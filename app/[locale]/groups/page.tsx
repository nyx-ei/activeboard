import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
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
  const t = await getTranslations('Dashboard');
  const supabase = createSupabaseServerClient();
  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membership?.group_id) {
    redirect(`/${locale}/groups/${membership.group_id}${searchParams.live === '1' ? '?live=1' : ''}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      <section className="mx-auto flex w-full max-w-[620px] flex-1 items-center justify-center px-4 py-8">
        <div className="surface-mockup w-full max-w-[520px] p-6 text-center">
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t('groups')}</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-400">{t('emptyGroups')}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/create-group" className="button-primary rounded-[7px] px-5 py-2.5 text-sm">
              {t('createGroup')}
            </Link>
            <Link href="/dashboard?view=sessions" className="button-ghost rounded-[7px] px-5 py-2.5 text-sm text-slate-400">
              {t('sessions')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
