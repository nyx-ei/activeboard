'use client';

import { useMemo, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';

export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const search = useMemo(() => searchParams.toString(), [searchParams]);
  const nextLocale = locale === 'en' ? 'fr' : 'en';

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(() => {
          const currentPath = window.location.pathname;
          const localizedPath = currentPath.replace(/^\/(en|fr)(?=\/|$)/, `/${nextLocale}`);
          const nextPath = search ? `${localizedPath}?${search}` : localizedPath;
          window.location.assign(nextPath);
        });
      }}
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
      aria-label={isPending ? t('switchingLanguage') : t('language')}
      disabled={isPending}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-slate-400">
        <path
          d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm6.9 8h-3.06a13.7 13.7 0 0 0-1.48-5.02A7.52 7.52 0 0 1 18.9 11ZM12 4.5c.92 1.14 1.95 3.33 2.3 6.5H9.7c.35-3.17 1.38-5.36 2.3-6.5Zm-2.36 1.48A13.7 13.7 0 0 0 8.16 11H5.1a7.52 7.52 0 0 1 4.54-5.02ZM4.5 12.5h3.54c.08 1.82.45 3.55 1.1 5.02A7.52 7.52 0 0 1 4.5 12.5Zm5.2 0h4.6c-.1 1.53-.43 3.03-1 4.42c-.46 1.12-.97 1.96-1.3 2.37c-.33-.4-.84-1.25-1.3-2.37a13.3 13.3 0 0 1-1-4.42Zm5.16 5.02c.65-1.47 1.02-3.2 1.1-5.02h3.54a7.52 7.52 0 0 1-4.64 5.02Z"
          fill="currentColor"
        />
      </svg>
      <span>{locale === 'en' ? t('english') : t('french')}</span>
    </button>
  );
}
