'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type SessionStageRefreshProps = {
  sessionId: string;
  expectedStatus: string;
  expectedQuestionId?: string | null;
};

type RuntimePayload = {
  ok: boolean;
  sessionStatus: string;
  questionId: string | null;
  questionPhase: string | null;
};

const POLL_INTERVAL_MS = 2000;

export function SessionStageRefresh({
  sessionId,
  expectedStatus,
  expectedQuestionId = null,
}: SessionStageRefreshProps) {
  const router = useRouter();
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const syncStage = async () => {
      if (document.visibilityState !== 'visible' || refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const response = await fetch(`/api/sessions/${sessionId}/runtime`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as RuntimePayload;
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

    void syncStage();
    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncStage();
      }
      startPolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [expectedQuestionId, expectedStatus, router, sessionId]);

  return null;
}
