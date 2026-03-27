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
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center">
      <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="surface hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{t('eyebrow')}</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{t('title')}</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{t('description')}</p>
          </div>
          <div className="rounded-3xl bg-slate-950 p-6 text-slate-100">
            <p className="text-sm text-slate-300">{t('highlightsTitle')}</p>
            <ul className="mt-3 space-y-3 text-sm leading-6">
              <li>{t('highlightTimer')}</li>
              <li>{t('highlightInvites')}</li>
              <li>{t('highlightReview')}</li>
            </ul>
          </div>
        </section>
        <div className="flex items-center justify-center">
          <Suspense
            fallback={
              <div className="surface w-full max-w-xl p-8 sm:p-10">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{t('eyebrow')}</p>
                <h1 className="mt-4 text-3xl font-semibold text-slate-950">{t('title')}</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">{t('description')}</p>
              </div>
            }
          >
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
