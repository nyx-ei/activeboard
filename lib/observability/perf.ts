import 'server-only';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import type { Json } from '@/lib/supabase/types';

const PERF_ENABLED = process.env.NODE_ENV !== 'production';

type PerfLogContext = {
  userId?: string | null;
  groupId?: string | null;
  sessionId?: string | null;
  locale?: AppLocale | null;
  sampleRate?: number;
  minDurationMs?: number;
  metadata?: Record<string, Json | undefined>;
};

export function createPerfTracker(label: string, initialContext?: PerfLogContext) {
  const startedAt = Date.now();
  const steps: Array<{ label: string; elapsedMs: number; durationMs: number }> = [];
  let lastStepAt = startedAt;
  let logContext = initialContext ?? null;

  function shouldPersist(elapsedMs: number) {
    if (!logContext) return false;
    const minDurationMs = logContext.minDurationMs ?? 0;
    if (elapsedMs < minDurationMs) {
      return false;
    }

    const sampleRate = logContext.sampleRate ?? 1;
    if (sampleRate <= 0) {
      return false;
    }

    return sampleRate >= 1 || Math.random() <= sampleRate;
  }

  return {
    setContext(nextContext: PerfLogContext) {
      logContext = {
        ...(logContext ?? {}),
        ...nextContext,
      };
    },
    step(stepLabel: string) {
      if (!PERF_ENABLED) return;
      const now = Date.now();
      const elapsed = now - startedAt;
      const duration = now - lastStepAt;
      lastStepAt = now;
      steps.push({
        label: stepLabel,
        elapsedMs: elapsed,
        durationMs: duration,
      });
      console.info(`[perf] ${label}:${stepLabel} ${elapsed}ms`);
    },
    snapshot() {
      return {
        label,
        totalMs: Date.now() - startedAt,
        steps: [...steps],
      };
    },
    done(metadata?: Record<string, unknown>) {
      const elapsed = Date.now() - startedAt;
      if (PERF_ENABLED) {
        console.info(`[perf] ${label}:done ${elapsed}ms`, {
          ...(metadata ?? {}),
          steps,
        });
      }

      if (!shouldPersist(elapsed)) {
        return;
      }

      void logAppEvent({
        eventName: APP_EVENTS.performanceTraceRecorded,
        flagKey: 'canUsePerformanceLogging',
        useAdmin: true,
        locale: logContext?.locale ?? null,
        userId: logContext?.userId ?? null,
        groupId: logContext?.groupId ?? null,
        sessionId: logContext?.sessionId ?? null,
        metadata: {
          trace_name: label,
          total_ms: elapsed,
          steps,
          ...(logContext?.metadata ?? {}),
          ...(metadata ?? {}),
        },
      });
    },
  };
}
