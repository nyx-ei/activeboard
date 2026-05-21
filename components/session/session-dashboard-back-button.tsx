'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';
import {
  SessionLeaveConfirmDialog,
  type SessionLeaveConfirmLabels,
} from '@/components/session/session-leave-confirm-dialog';

export function SessionDashboardBackButton({
  locale,
  label,
  variant = 'icon',
  sessionId,
  confirmLabels,
}: {
  locale: string;
  label?: string;
  variant?: 'icon' | 'text';
  sessionId?: string;
  confirmLabels?: SessionLeaveConfirmLabels;
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const href = `/${locale}/dashboard`;

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.prefetch(href as never);
    }, 250);

    return () => window.clearTimeout(id);
  }, [href, router]);

  useEffect(() => {
    if (!isConfirming) {
      return;
    }

    router.prefetch(href as never);
  }, [href, isConfirming, router]);

  const goBack = () => {
    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    setIsConfirming(false);
    window.sessionStorage.removeItem('activeboard:session-flow-active');
    markDashboardPayloadStale('sessions');
    markDashboardPayloadStale('performance');
    router.prefetch(href as never);
    if (sessionId) {
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
    }
    router.replace(href as never);
  };

  const handleClick = () => {
    if (confirmLabels && !isConfirming) {
      router.prefetch(href as never);
      setIsConfirming(true);
      return;
    }

    goBack();
  };

  if (variant === 'text') {
    return (
      <>
        <button
          type="button"
          disabled={isNavigating}
          onClick={handleClick}
          onPointerEnter={() => router.prefetch(href as never)}
          className="button-ghost mt-4 px-4 py-2 text-sm text-slate-500 disabled:cursor-wait disabled:opacity-70"
          aria-busy={isNavigating}
        >
          {isNavigating ? (label ?? '') : label}
        </button>
        {isConfirming && confirmLabels ? (
          <SessionLeaveConfirmDialog
            labels={confirmLabels}
            isLeaving={isNavigating}
            onCancel={() => setIsConfirming(false)}
            onConfirm={goBack}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={isNavigating}
        onClick={handleClick}
        onPointerEnter={() => router.prefetch(href as never)}
        className="inline-flex h-7 w-7 items-center justify-start text-slate-500 hover:text-white disabled:cursor-wait disabled:opacity-70 sm:h-10 sm:w-10"
        aria-label={label}
        aria-busy={isNavigating}
      >
        {isNavigating ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : (
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {isConfirming && confirmLabels ? (
        <SessionLeaveConfirmDialog
          labels={confirmLabels}
          isLeaving={isNavigating}
          onCancel={() => setIsConfirming(false)}
          onConfirm={goBack}
        />
      ) : null}
    </>
  );
}
