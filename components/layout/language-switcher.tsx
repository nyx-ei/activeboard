'use client';

import { Globe } from 'lucide-react';
import { useMemo, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const query = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const nextLocale = locale === 'en' ? 'fr' : 'en';
  const displayedLocale = routing.locales.length === 2 ? nextLocale : locale;

  return (
    <button
      type="button"
      onClick={() => {
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
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
      aria-label={isPending ? t('switchingLanguage') : t('language')}
      disabled={isPending}
    >
      <Globe aria-hidden="true" className="h-4 w-4 text-slate-400" />
      <span>{displayedLocale === 'en' ? t('english') : t('french')}</span>
    </button>
  );
}
