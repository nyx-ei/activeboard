import { WifiOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

type OfflinePageProps = {
  params: { locale: string };
};

export default async function OfflinePage({ params }: OfflinePageProps) {
  const t = await getTranslations('Offline');

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[720px] items-center justify-center px-4 py-10">
      <section className="w-full rounded-[28px] border border-white/[0.08] bg-[#0f1729] p-8 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
          <WifiOff className="h-7 w-7" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-amber-200/80">{t('eyebrow')}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{t('title')}</h1>
        <p className="mt-4 max-w-[56ch] text-base leading-7 text-slate-300">{t('description')}</p>
        <div className="mt-8 grid gap-3 rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 text-sm text-slate-300">
          <p>{t('tipRefresh')}</p>
          <p>{t('tipReconnect')}</p>
          <p>{t('tipFallback')}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            locale={params.locale}
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t('backToApp')}
          </Link>
          <Link
            href="/"
            locale={params.locale}
            className="inline-flex items-center justify-center rounded-full border border-white/[0.12] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/[0.24] hover:text-white"
          >
            {t('backHome')}
          </Link>
        </div>
      </section>
    </main>
  );
}
