'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { Link } from '@/i18n/navigation';

export function HomeHeaderNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('Landing');
  const isHome = pathname === `/${locale}` || pathname === '/';
  const isAuth = pathname?.startsWith(`/${locale}/auth`);
  const howItWorksHref = isHome ? '#how-it-works' : `/${locale}#how-it-works`;
  const pricingHref = isHome ? '#pricing' : `/${locale}#pricing`;

  if (!isHome && !isAuth) {
    return null;
  }

  return (
    <nav className="flex items-center gap-3 text-xs font-bold text-slate-400 sm:gap-7 sm:text-sm">
      <a href={howItWorksHref} className="transition hover:text-white">
        {t('navHowItWorks')}
      </a>
      <a href={pricingHref} className="transition hover:text-white">
        {t('navPricing')}
      </a>
      <Link href="/auth/login" className="transition hover:text-white">
        {t('navSignIn')}
      </Link>
    </nav>
  );
}
