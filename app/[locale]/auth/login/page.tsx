import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AuthForm } from '@/components/auth/auth-form';
import { getCurrentUser } from '@/lib/auth';
import type { AppLocale } from '@/i18n/routing';

type LoginPageProps = {
  params: { locale: string };
};

export default async function LoginPage({ params }: LoginPageProps) {
  const locale = params.locale as AppLocale;
  const user = await getCurrentUser();
  const t = await getTranslations('Auth');

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center py-10">
      <div className="flex w-full items-center justify-center">
          <Suspense
            fallback={
              <div className="surface w-full max-w-xl p-8 sm:p-10">
                <h1 className="mt-1 text-3xl font-extrabold text-white">{t('title')}</h1>
              </div>
            }
          >
            <AuthForm />
          </Suspense>
      </div>
    </main>
  );
}
