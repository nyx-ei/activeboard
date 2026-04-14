import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';

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
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {common('continue')}
      </Link>
    </main>
  );
}
