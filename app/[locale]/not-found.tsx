import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function LocaleNotFoundPage() {
  const common = await getTranslations('Common');
  const t = await getTranslations('NotFound');

  return (
    <main className="surface mx-auto my-auto flex max-w-2xl flex-1 flex-col items-start justify-center p-8 sm:p-10">
      <p className="text-sm uppercase tracking-[0.22em] text-slate-500">404</p>
      <h1 className="mt-4 text-3xl font-semibold text-slate-950">{t('title')}</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">{t('description')}</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
      >
        {common('continue')}
      </Link>
    </main>
  );
}

