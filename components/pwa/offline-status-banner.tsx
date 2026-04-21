'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export function OfflineStatusBanner() {
  const t = useTranslations('Offline');
  const locale = useLocale();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const syncStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    syncStatus();
    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);

    return () => {
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="sticky top-2 z-40 rounded-[12px] border border-amber-400/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 shadow-[0_12px_32px_rgba(15,23,42,0.28)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/14 text-amber-200">
          <WifiOff className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-50">{t('bannerTitle')}</p>
          <p className="mt-1 text-amber-100/90">{t('bannerDescription')}</p>
          <Link
            href={{ pathname: '/offline' }}
            locale={locale}
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 underline decoration-amber-200/50 underline-offset-4"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('openFallback')}
          </Link>
        </div>
      </div>
    </div>
  );
}
