'use client';

import { useEffect } from 'react';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { postClientAppEvent } from '@/lib/logging/client';

function isStandaloneLaunch() {
  if (typeof window === 'undefined') {
    return false;
  }

  const standaloneMatch = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const androidAppReferrer = document.referrer.startsWith('android-app://');

  return standaloneMatch || iosStandalone || androidAppReferrer;
}

export function PwaLaunchTracker({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !isStandaloneLaunch()) {
      return;
    }

    const storageKey = 'activeboard:pwa-launch-logged';
    if (window.sessionStorage.getItem(storageKey) === '1') {
      return;
    }

    window.sessionStorage.setItem(storageKey, '1');
    void postClientAppEvent(APP_EVENTS.pwaLaunchedFromHomeScreen, locale, {
      display_mode: window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      referrer: document.referrer ? 'external' : 'direct',
    });
  }, [locale]);

  return null;
}
