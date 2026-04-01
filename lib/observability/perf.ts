const PERF_ENABLED = process.env.NODE_ENV !== 'production';

export function createPerfTracker(label: string) {
  const startedAt = Date.now();

  return {
    step(stepLabel: string) {
      if (!PERF_ENABLED) return;
      const elapsed = Date.now() - startedAt;
      console.info(`[perf] ${label}:${stepLabel} ${elapsed}ms`);
    },
    done(metadata?: Record<string, unknown>) {
      if (!PERF_ENABLED) return;
      const elapsed = Date.now() - startedAt;
      console.info(`[perf] ${label}:done ${elapsed}ms`, metadata ?? {});
    },
  };
}
