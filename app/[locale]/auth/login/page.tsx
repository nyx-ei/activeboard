import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AuthForm } from '@/components/auth/auth-form';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppLocale } from '@/i18n/routing';

type LoginPageProps = {
  params: { locale: string };
};

export default async function LoginPage({ params }: LoginPageProps) {
  const locale = params.locale as AppLocale;
  const user = await getCurrentUser();
  const t = await getTranslations('Auth');

  if (user) {
    const supabase = createSupabaseServerClient();
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
            <AuthForm requireExamSessionOnSignUp={false} signUpRedirectToOverride={`/${locale}/create-group`} />
          </Suspense>
      </div>
    </main>
  );
}
