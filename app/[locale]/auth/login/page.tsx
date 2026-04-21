import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AuthForm } from '@/components/auth/auth-form';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppLocale } from '@/i18n/routing';

type LoginPageProps = {
  params: { locale: string };
  searchParams?: { next?: string };
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const locale = params.locale as AppLocale;
  const user = await getCurrentUser();
  const t = await getTranslations('Auth');
  const next = searchParams?.next;
  const isInviteNext = typeof next === 'string' && next.startsWith(`/${locale}/invite/`);

  if (user) {
    const supabase = createSupabaseServerClient();

    if (typeof next === 'string' && next.startsWith(`/${locale}/`)) {
      redirect(next);
    }

    const normalizedEmail = user.email?.trim().toLowerCase() ?? '';
    const { data: pendingInvite } = await supabase
      .schema('public')
      .from('group_invites')
      .select('id')
      .eq('status', 'pending')
      .or(`invitee_user_id.eq.${user.id},invitee_email.eq.${normalizedEmail}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingInvite?.id) {
      redirect(`/${locale}/invite/${pendingInvite.id}`);
    }

    const { data: firstMembership } = await supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    redirect(firstMembership?.group_id ? `/${locale}/dashboard` : `/${locale}/create-group`);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full items-center justify-center">
          <Suspense
            fallback={
              <div className="w-full max-w-[410px] text-center">
                <h1 className="mt-1 text-3xl font-extrabold text-white">{t('title')}</h1>
              </div>
            }
          >
            <AuthForm
              requireExamSessionOnSignUp={false}
              deferSignUpToRedirect={!isInviteNext}
              signUpRedirectToOverride={typeof next === 'string' && next.startsWith(`/${locale}/`) ? next : `/${locale}/create-group`}
            />
          </Suspense>
      </div>
    </main>
  );
}
