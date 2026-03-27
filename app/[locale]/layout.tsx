import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { routing, type AppLocale } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const locale = params.locale as AppLocale;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations('Common');

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RegisterServiceWorker />
      <div className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col gap-6">
          <header className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/60 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
                A
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">ActiveBoard</p>
                <p className="text-sm text-slate-600">{t('appTagline')}</p>
              </div>
            </div>
            <Suspense
              fallback={
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 p-1 text-sm shadow-sm">
                  <span className="px-3 text-slate-500">{t('language')}</span>
                </div>
              }
            >
              <LanguageSwitcher />
            </Suspense>
          </header>
          {children}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
