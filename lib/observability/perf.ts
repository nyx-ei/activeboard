const PERF_ENABLED = process.env.NODE_ENV !== 'production';

export function createPerfTracker(label: string) {
  const startedAt = Date.now();
  const steps: Array<{ label: string; elapsedMs: number; durationMs: number }> = [];
  let lastStepAt = startedAt;

  return {
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
      if (!PERF_ENABLED) return;
      const elapsed = Date.now() - startedAt;
      console.info(`[perf] ${label}:done ${elapsed}ms`, {
        ...(metadata ?? {}),
        steps,
      });
    },
  };
}
