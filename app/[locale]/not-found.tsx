import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function LocaleNotFoundPage() {
  const common = await getTranslations('Common');
  const t = await getTranslations('NotFound');

  return (
    <main className="surface mx-auto my-auto flex max-w-2xl flex-1 flex-col items-start justify-center p-8 sm:p-10">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-slate-400">{t('description')}</p>
      <Link href="/" className="button-primary mt-6">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M15 6l-6 6l6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
        {common('continue')}
      </Link>
    </main>
  );
}
