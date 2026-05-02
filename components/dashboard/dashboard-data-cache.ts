'use client';

export type DashboardView = 'sessions' | 'performance';

type CacheEntry<TPayload> = {
  payload?: TPayload;
  promise?: Promise<TPayload | null>;
  expiresAt: number;
};

type CacheMap<TPayloadByView extends Record<DashboardView, unknown>> = {
  [TView in DashboardView]: CacheEntry<TPayloadByView[TView]>;
};

const DASHBOARD_DATA_TTL_MS = 5_000;
const DASHBOARD_STALE_STORAGE_KEY = 'activeboard:dashboard-stale-views';

const dashboardPayloadCache = {
  sessions: { expiresAt: 0 },
  performance: { expiresAt: 0 },
} as CacheMap<Record<DashboardView, unknown>>;
const activeDashboardControllers = new Set<AbortController>();

function isSessionFlowActive() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.sessionStorage.getItem('activeboard:session-flow-active') === '1' ||
    window.location.pathname.includes('/sessions/')
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('activeboard:session-flow-started', () => {
    for (const controller of activeDashboardControllers) {
      controller.abort();
    }
    activeDashboardControllers.clear();
    dashboardPayloadCache.sessions.promise = undefined;
    dashboardPayloadCache.performance.promise = undefined;
  });
}

export function seedDashboardPayload<
  TPayloadByView extends Record<DashboardView, unknown>,
  TView extends DashboardView,
>(view: TView, payload: TPayloadByView[TView]) {
  const cacheEntry = dashboardPayloadCache[view] as CacheEntry<
    TPayloadByView[TView]
  >;
  cacheEntry.payload = payload;
  cacheEntry.expiresAt = Date.now() + DASHBOARD_DATA_TTL_MS;
}

export function invalidateDashboardPayloadCache(view?: DashboardView) {
  if (view) {
    dashboardPayloadCache[view].expiresAt = 0;
    dashboardPayloadCache[view].payload = undefined;
    return;
  }

  dashboardPayloadCache.sessions.expiresAt = 0;
  dashboardPayloadCache.sessions.payload = undefined;
  dashboardPayloadCache.performance.expiresAt = 0;
  dashboardPayloadCache.performance.payload = undefined;
}

function readStaleViews() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(DASHBOARD_STALE_STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is DashboardView =>
            value === 'sessions' || value === 'performance',
        )
      : [];
  } catch {
    return [];
  }
}

function writeStaleViews(views: DashboardView[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DASHBOARD_STALE_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(views))),
    );
  } catch {
    // The in-memory cache invalidation still applies when storage is blocked.
  }
}

export function markDashboardPayloadStale(view: DashboardView) {
  invalidateDashboardPayloadCache(view);
  writeStaleViews([...readStaleViews(), view]);
}

export function consumeDashboardPayloadStale(view?: DashboardView) {
  const staleViews = readStaleViews();
  if (staleViews.length === 0) {
    return [];
  }

  const consumedViews = view
    ? staleViews.filter((staleView) => staleView === view)
    : staleViews;
  const remainingViews = view
    ? staleViews.filter((staleView) => staleView !== view)
    : [];

  writeStaleViews(remainingViews);
  return consumedViews;
}

export async function fetchDashboardPayload<
  TPayloadByView extends Record<DashboardView, unknown>,
  TView extends DashboardView,
>(view: TView): Promise<TPayloadByView[TView] | null> {
  if (isSessionFlowActive()) {
    return null;
  }

  const cacheEntry = dashboardPayloadCache[view] as CacheEntry<
    TPayloadByView[TView]
  >;
  const now = Date.now();

  if (cacheEntry.payload && cacheEntry.expiresAt > now) {
    return cacheEntry.payload;
  }

  if (cacheEntry.promise) {
    return cacheEntry.promise;
  }

  const controller = new AbortController();
  activeDashboardControllers.add(controller);

  const promise = fetch(`/api/dashboard/${view}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (isSessionFlowActive()) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as TPayloadByView[TView] & {
        ok?: boolean;
      };
      if (!payload.ok) {
        return null;
      }

      cacheEntry.payload = payload;
      cacheEntry.expiresAt = Date.now() + DASHBOARD_DATA_TTL_MS;
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      activeDashboardControllers.delete(controller);
      cacheEntry.promise = undefined;
    });

  cacheEntry.promise = promise;
  return promise;
}
