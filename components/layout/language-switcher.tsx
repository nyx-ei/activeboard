'use client';

import { Globe } from 'lucide-react';
import { useMemo, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/i18n/navigation';
import { type AppLocale } from '@/i18n/routing';

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
      className="inline-flex items-center gap-2 rounded-full px-1.5 py-1 text-sm font-semibold text-[#8fa7a2] transition hover:text-white sm:px-2 sm:text-base"
      aria-label={isPending ? t('switchingLanguage') : t('language')}
      disabled={isPending}
    >
      <Globe
        aria-hidden="true"
        className="h-4 w-4 text-[#8fa7a2] sm:h-5 sm:w-5"
      />
      <span className="text-[#cde3de]">
        {nextLocale === 'en' ? t('english') : t('french')}
      </span>
    </button>
  );
}
