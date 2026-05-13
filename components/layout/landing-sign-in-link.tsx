'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';

export function LandingSignInLink() {
  const pathname = usePathname();
  const t = useTranslations('Common');

  if (pathname !== '/') {
    return null;
  }

  return (
    <Link
      href="/auth/login"
      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:border-brand/40 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
    >
      {t('signIn')}
    </Link>
  );
}
