'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Link } from '@/i18n/navigation';

type SessionAutoStartRuntimeProps = {
  locale: string;
  sessionId: string;
  backLabel: string;
};

const copy = {
  en: {
    starting: 'Starting sprint...',
    error: 'The sprint could not be started. Please try again.',
    back: 'Back to session progress',
  },
  fr: {
    starting: 'Demarrage du sprint...',
    error: "Le sprint n'a pas pu demarrer. Reessaie.",
    back: 'Retour a la progression',
  },
} as const;

export function SessionAutoStartRuntime({
  locale,
  sessionId,
  backLabel,
}: SessionAutoStartRuntimeProps) {
  const language = locale === 'fr' ? 'fr' : 'en';
  const t = copy[language];
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    const controller = new AbortController();

    void fetch(`/api/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({ locale: language }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
          redirectTo?: string;
        } | null;

        if (!response.ok) {
          setError(payload?.message ?? t.error);
          return;
        }

        router.replace(
          (payload?.redirectTo ??
            `/${language}/sessions/${sessionId}?q=0`) as never,
        );
        router.refresh();
      })
      .catch((reason) => {
        if ((reason as { name?: string })?.name !== 'AbortError') {
          setError(t.error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [language, router, sessionId, t.error]);

  return (
    <section className="flex flex-1 items-center justify-center px-4 py-10 text-center text-white">
      <div className="w-full max-w-sm rounded-[18px] border border-white/10 bg-[#071f1c]/85 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        {error ? (
          <>
            <p className="text-sm font-bold text-rose-200">{error}</p>
            <Link
              href={`/sessions/${sessionId}?stage=progress` as never}
              prefetch={false}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-[8px] border border-brand/35 px-4 text-sm font-extrabold text-brand transition hover:bg-brand/10"
              aria-label={backLabel}
            >
              {t.back}
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2
              className="h-7 w-7 animate-spin text-brand"
              aria-hidden="true"
            />
            <p className="text-sm font-extrabold text-slate-200">
              {t.starting}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
