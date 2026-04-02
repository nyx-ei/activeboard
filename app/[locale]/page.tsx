import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { SubmitButton } from '@/components/ui/submit-button';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';

import { joinSessionByCodeAction } from './dashboard/actions';

type LocaleHomePageProps = {
  params: { locale: string };
};

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const locale = params.locale as AppLocale;
  const user = await getCurrentUser();
  const t = await getTranslations('Landing');

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-10">
      <section className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col items-center justify-center gap-12 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mx-auto max-w-[980px] text-balance text-5xl font-extrabold tracking-tight text-white md:text-7xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-9 text-slate-400">{t('description')}</p>
        </div>

        <form action={joinSessionByCodeAction} className="mx-auto flex w-full max-w-[540px] flex-col gap-4 sm:flex-row">
          <input type="hidden" name="locale" value={locale} />
          <input
            name="sessionCode"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={t('sessionCodePlaceholder')}
            className="field flex-1 px-6 py-4 text-center text-base uppercase tracking-[0.18em]"
          />
          <SubmitButton pendingLabel={t('joinPending')} className="button-primary min-w-[164px]">
            {t('joinSession')}
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
