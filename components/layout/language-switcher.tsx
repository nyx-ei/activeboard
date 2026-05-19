'use client';

import { Globe } from 'lucide-react';
import { useMemo, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

type LanguageSwitcherProps = {
  persistUserPreference?: boolean;
};

export function LanguageSwitcher({
  persistUserPreference = true,
}: LanguageSwitcherProps) {
  const t = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const query = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams],
  );
  const nextLocale = locale === 'en' ? 'fr' : 'en';

  function persistLocalePreference(selectedLocale: AppLocale) {
    if (!persistUserPreference) {
      return;
    }

    void fetch('/api/user/locale', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: selectedLocale }),
    }).catch(() => {
      // Language navigation must remain instant even if preference persistence fails.
    });
  }

  return (
    <button
      type="button"
      onClick={() => {
        persistLocalePreference(nextLocale);
        startTransition(() => {
          router.replace(
            {
              pathname,
              query,
            },
            { locale: nextLocale },
          );
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.04] hover:text-white sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
      aria-label={isPending ? t('switchingLanguage') : t('language')}
      disabled={isPending}
    >
      <Globe
        aria-hidden="true"
        className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4"
      />
      <span className="inline-flex items-center gap-1">
        {routing.locales.map((option, index) => (
          <span key={option} className="inline-flex items-center gap-1">
            <span
              className={option === locale ? 'text-white' : 'text-slate-500'}
            >
              {option === 'en' ? t('english') : t('french')}
            </span>
            {index < routing.locales.length - 1 ? (
              <span className="text-slate-600">/</span>
            ) : null}
          </span>
        ))}
      </span>
    </button>
  );
}
