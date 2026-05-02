'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { fetchSessionRuntime } from '@/components/session/runtime-client';

type SessionStageRefreshProps = {
  sessionId: string;
  expectedStatus: string;
  expectedQuestionId?: string | null;
};

const POLL_INTERVAL_MS = 60000;

export function SessionStageRefresh({
  sessionId,
  expectedStatus,
  expectedQuestionId = null,
}: SessionStageRefreshProps) {
  const router = useRouter();
  const refreshInFlightRef = useRef(false);

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
        const payload = await fetchSessionRuntime(`/api/sessions/${sessionId}/runtime`);

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
    const handlePause = () => {
      paused = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('activeboard:session-starting', handlePause);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('activeboard:session-starting', handlePause);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [expectedQuestionId, expectedStatus, router, sessionId]);

  return null;
}
