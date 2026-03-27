'use client';

import { useMemo, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';

const localeOptions: AppLocale[] = ['en', 'fr'];

export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const search = useMemo(() => searchParams.toString(), [searchParams]);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 p-1 text-sm shadow-sm">
      <span className="px-3 text-slate-500">{isPending ? t('switchingLanguage') : t('language')}</span>
      {localeOptions.map((option) => {
        const isActive = option === locale;

        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              startTransition(() => {
                const currentPath = window.location.pathname;
                const localizedPath = currentPath.replace(/^\/(en|fr)(?=\/|$)/, `/${option}`);
                const nextPath = search ? `${localizedPath}?${search}` : localizedPath;
                window.location.assign(nextPath);
              });
            }}
            className={[
              'rounded-full px-3 py-2 transition',
              isActive ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
            aria-pressed={isActive}
            disabled={isPending}
          >
            {option === 'en' ? t('english') : t('french')}
          </button>
        );
      })}
    </div>
  );
}
