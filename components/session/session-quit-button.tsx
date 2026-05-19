'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';
import {
  SessionLeaveConfirmDialog,
  type SessionLeaveConfirmLabels,
} from '@/components/session/session-leave-confirm-dialog';

export function SessionQuitButton({
  locale,
  sessionId,
  label,
  pendingLabel,
  confirmLabels,
}: {
  locale: string;
  sessionId: string;
  label: string;
  pendingLabel: string;
  confirmLabels: SessionLeaveConfirmLabels;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const leaveSession = () => {
    if (isLeaving) {
      return;
    }

    setIsLeaving(true);
    setIsConfirming(false);
    const redirectTo = `/${locale}/dashboard`;
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
  };

  return (
    <>
      <button
        type="button"
        disabled={isLeaving}
        onClick={() => setIsConfirming(true)}
        className="button-ghost px-4 py-2 text-sm text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
        aria-busy={isLeaving}
      >
        {isLeaving ? pendingLabel : label}
      </button>
      {isConfirming ? (
        <SessionLeaveConfirmDialog
          labels={confirmLabels}
          isLeaving={isLeaving}
          onCancel={() => setIsConfirming(false)}
          onConfirm={leaveSession}
        />
      ) : null}
    </>
  );
}
