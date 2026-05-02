'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';

export function SessionQuitButton({
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
  const [isLeaving, setIsLeaving] = useState(false);

  return (
    <button
      type="button"
      disabled={isLeaving}
      onClick={() => {
        if (isLeaving) {
          return;
        }

        setIsLeaving(true);
        const redirectTo = `/${locale}/dashboard?view=sessions`;
        window.sessionStorage.removeItem('activeboard:session-flow-active');
        markDashboardPayloadStale('sessions');
        router.prefetch(redirectTo as never);
        void fetch(`/api/sessions/${sessionId}/quit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
          body: JSON.stringify({ locale }),
        });
        router.replace(redirectTo as never);
        window.setTimeout(() => router.refresh(), 0);
      }}
      className="button-ghost px-4 py-2 text-sm text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
      aria-busy={isLeaving}
    >
      {isLeaving ? pendingLabel : label}
    </button>
  );
}
