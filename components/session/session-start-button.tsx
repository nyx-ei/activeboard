'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SessionStartButton({
  locale,
  sessionId,
  label,
  pendingLabel,
}: {
  locale: string;
  sessionId: string;
  label: string;
  pendingLabel: string;
}) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="mt-7">
      <button
        type="button"
        disabled={isStarting}
        onClick={() => {
          if (isStarting) {
            return;
          }

          setIsStarting(true);
          setErrorMessage(null);
          const startedAt = performance.now();
          window.sessionStorage.setItem('activeboard:session-flow-active', '1');
          window.dispatchEvent(
            new CustomEvent('activeboard:session-flow-started'),
          );
          window.dispatchEvent(new CustomEvent('activeboard:session-starting'));
          void fetch(`/api/sessions/${sessionId}/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({ locale }),
          })
            .then(async (response) => {
              const payload = (await response.json().catch(() => null)) as {
                ok?: boolean;
                message?: string;
                redirectTo?: string;
              } | null;

              if (payload?.redirectTo) {
                console.info(
                  `[perf] startSession:api ${Math.round(performance.now() - startedAt)}ms`,
                );
                router.replace(payload.redirectTo as never);
                return;
              }

              if (!response.ok || payload?.ok === false) {
                window.sessionStorage.removeItem(
                  'activeboard:session-flow-active',
                );
                setErrorMessage(payload?.message ?? pendingLabel);
                setIsStarting(false);
                return;
              }

              setIsStarting(false);
            })
            .catch(() => {
              window.sessionStorage.removeItem('activeboard:session-flow-active');
              setErrorMessage(pendingLabel);
              setIsStarting(false);
            });
        }}
        className="button-primary rounded-[7px] px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
        aria-busy={isStarting}
      >
        <span className="mr-2" aria-hidden="true">
          {'>'}
        </span>
        {isStarting ? pendingLabel : label}
      </button>
      {errorMessage ? (
        <p className="mt-3 text-sm font-semibold text-rose-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
