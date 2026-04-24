'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { postClientAppEvent } from '@/lib/logging/client';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'activeboard:pwa-install-dismissed-at';
const SESSION_HIDE_KEY = 'activeboard:pwa-install-hidden-session';
const SESSION_SHOWN_KEY = 'activeboard:pwa-install-shown-session';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_DELAY_MS = 12_000;

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const standaloneMatch = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return standaloneMatch || iosStandalone;
}

export function InstallPrompt({ locale }: { locale: AppLocale }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const promptTimerRef = useRef<number | null>(null);
  const hasLoggedShownRef = useRef(false);

  const shouldSuppressPrompt = useMemo(() => {
    if (typeof window === 'undefined' || isStandaloneDisplayMode()) {
      return true;
    }

    if (window.sessionStorage.getItem(SESSION_HIDE_KEY) === '1') {
      return true;
    }

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  }, []);

  useEffect(() => {
    if (!deferredPrompt || shouldSuppressPrompt) {
      setIsVisible(false);
      return undefined;
    }

    if (window.sessionStorage.getItem(SESSION_SHOWN_KEY) === '1') {
      setIsVisible(true);
      return undefined;
    }

    promptTimerRef.current = window.setTimeout(() => {
      window.sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      setIsVisible(true);
    }, PROMPT_DELAY_MS);

    return () => {
      if (promptTimerRef.current) {
        window.clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
    };
  }, [deferredPrompt, shouldSuppressPrompt]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      window.sessionStorage.setItem(SESSION_HIDE_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [locale]);

  useEffect(() => {
    if (!isVisible || hasLoggedShownRef.current) {
      return;
    }

    hasLoggedShownRef.current = true;
    void postClientAppEvent(APP_EVENTS.pwaInstallPromptShown, locale, {
      display_mode: isStandaloneDisplayMode() ? 'standalone' : 'browser',
    });
  }, [isVisible, locale]);

  if (!deferredPrompt || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 rounded-[14px] border border-white/[0.08] bg-[#10192d]/95 px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.5)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-white">Install ActiveBoard</p>
          <p className="mt-1 text-xs text-slate-400">Add the app to your home screen for faster access.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
              window.sessionStorage.setItem(SESSION_HIDE_KEY, '1');
              setIsVisible(false);
            }}
            className="rounded-[8px] px-3 py-2 text-xs font-bold text-slate-400 transition hover:text-white"
          >
            Later
          </button>
          <button
            type="button"
            onClick={async () => {
              await deferredPrompt.prompt();
              const choice = await deferredPrompt.userChoice.catch(() => undefined);
              if (choice?.outcome === 'accepted') {
                void postClientAppEvent(APP_EVENTS.pwaInstallAccepted, locale, {
                  platform: choice.platform,
                });
              }
              window.sessionStorage.setItem(SESSION_HIDE_KEY, '1');
              setIsVisible(false);
              setDeferredPrompt(null);
            }}
            className="button-primary h-9 rounded-[8px] px-4 text-xs font-extrabold"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
