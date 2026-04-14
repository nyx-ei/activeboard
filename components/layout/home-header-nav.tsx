'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { Link } from '@/i18n/navigation';

export function HomeHeaderNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('Landing');
  const isHome = pathname === `/${locale}` || pathname === '/';

  if (!isHome) {
    return null;
  }

  return (
    <nav className="hidden items-center gap-7 text-sm font-bold text-slate-400 sm:flex">
      <a href="#how-it-works" className="transition hover:text-white">
        {t('navHowItWorks')}
      </a>
      <a href="#pricing" className="transition hover:text-white">
        {t('navPricing')}
      </a>
      <Link href="/auth/login" className="transition hover:text-white">
        {t('navSignIn')}
      </Link>
    </nav>
  );
}
