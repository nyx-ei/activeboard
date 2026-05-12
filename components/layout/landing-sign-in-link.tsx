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
      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-brand/40 hover:text-white"
    >
      {t('signIn')}
    </Link>
  );
}
