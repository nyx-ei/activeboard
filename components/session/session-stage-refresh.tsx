'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { fetchSessionRuntime } from '@/components/session/runtime-client';

type SessionStageRefreshProps = {
  sessionId: string;
  expectedStatus: string;
  expectedQuestionId?: string | null;
};

const POLL_INTERVAL_MS = 30_000;
const REALTIME_SYNC_JITTER_MS = 900;

const SessionStateRealtimeSync = dynamic(
  () =>
    import('@/components/session/session-state-realtime-sync').then(
      (mod) => mod.SessionStateRealtimeSync,
    ),
  { ssr: false },
);

export function SessionStageRefresh({
  sessionId,
  expectedStatus,
  expectedQuestionId = null,
}: SessionStageRefreshProps) {
  const router = useRouter();
  const refreshInFlightRef = useRef(false);
  const realtimeSyncTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let paused = false;
    let intervalId: number | null = null;

    const syncStage = async () => {
      if (
        paused ||
        document.visibilityState !== 'visible' ||
        refreshInFlightRef.current
      ) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const payload = await fetchSessionRuntime(
          `/api/sessions/${sessionId}/runtime`,
        );

        if (!payload || cancelled) {
          return;
        }
        const statusChanged = payload.sessionStatus !== expectedStatus;
        const questionChanged = payload.questionId !== expectedQuestionId;

        if (statusChanged || questionChanged) {
          router.refresh();
        }
      } catch {
        // Ignore transient polling failures and retry on the next interval.
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    const startPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      if (document.visibilityState !== 'visible') {
        intervalId = null;
        return;
      }

      intervalId = window.setInterval(() => {
        void syncStage();
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncStage();
      }
      startPolling();
    };
    const handleOnline = () => {
      void syncStage();
      startPolling();
    };
    const handleSessionStateSync = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail;
      if (detail?.sessionId === sessionId) {
        if (realtimeSyncTimeoutRef.current !== null) {
          window.clearTimeout(realtimeSyncTimeoutRef.current);
        }
        realtimeSyncTimeoutRef.current = window.setTimeout(() => {
          realtimeSyncTimeoutRef.current = null;
          void syncStage();
        }, Math.floor(Math.random() * REALTIME_SYNC_JITTER_MS));
      }
    };
    const handlePause = () => {
      paused = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener(
      'activeboard:session-state-sync',
      handleSessionStateSync,
    );
    window.addEventListener('activeboard:session-starting', handlePause);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(
        'activeboard:session-state-sync',
        handleSessionStateSync,
      );
      window.removeEventListener('activeboard:session-starting', handlePause);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (realtimeSyncTimeoutRef.current !== null) {
        window.clearTimeout(realtimeSyncTimeoutRef.current);
        realtimeSyncTimeoutRef.current = null;
      }
    };
  }, [expectedQuestionId, expectedStatus, router, sessionId]);

  return <SessionStateRealtimeSync sessionId={sessionId} />;
}
