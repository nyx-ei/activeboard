'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed) {
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
            onClick={() => setDismissed(true)}
            className="rounded-[8px] px-3 py-2 text-xs font-bold text-slate-400 transition hover:text-white"
          >
            Later
          </button>
          <button
            type="button"
            onClick={async () => {
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice.catch(() => undefined);
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
