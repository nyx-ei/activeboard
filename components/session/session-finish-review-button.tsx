'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SessionFinishReviewButton({
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
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isFinishing}
        onClick={() => {
          if (isFinishing) {
            return;
          }

          setIsFinishing(true);
          setErrorMessage(null);
          void fetch(`/api/sessions/${sessionId}/finish-review`, {
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

              if (payload?.redirectTo && response.ok) {
                router.replace(payload.redirectTo as never);
                return;
              }

              setErrorMessage(payload?.message ?? pendingLabel);
              setIsFinishing(false);
            })
            .catch(() => {
              setErrorMessage(pendingLabel);
              setIsFinishing(false);
            });
        }}
        className="hover:bg-brand/10 h-10 w-full rounded-[7px] border border-brand bg-transparent text-sm font-extrabold text-brand disabled:cursor-not-allowed disabled:opacity-70"
        aria-busy={isFinishing}
      >
        {isFinishing ? pendingLabel : label}
      </button>
      {errorMessage ? (
        <p className="mt-3 text-center text-sm font-semibold text-rose-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
