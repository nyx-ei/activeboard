'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DashboardPerformanceView,
  type DashboardPerformanceViewProps,
} from '@/components/dashboard/dashboard-performance-view';
import {
  fetchDashboardPayload,
  consumeDashboardPayloadStale,
  invalidateDashboardPayloadCache,
  seedDashboardPayload,
  type DashboardView,
} from '@/components/dashboard/dashboard-data-cache';
import {
  DashboardSessionsView,
  type DashboardSessionsViewProps,
} from '@/components/dashboard/dashboard-sessions-view';

type DashboardViewShellProps = {
  initialView: DashboardView;
  sessionsProps: DashboardSessionsViewProps;
  performanceProps: DashboardPerformanceViewProps;
  initialLoadedViews: Record<DashboardView, boolean>;
};
type DashboardSessionsPayload = {
  ok?: boolean;
  groups?: DashboardSessionsViewProps['groups'];
  sessions?: DashboardSessionsViewProps['sessions'];
};
type DashboardPerformancePayload = {
  ok?: boolean;
  metrics?: {
    answeredCount: number;
    completedSessionsCount: number;
    successRate: number | null;
    averageConfidence: DashboardPerformanceViewProps['averageConfidence'];
  };
  profileAnalytics?: {
    heatmap?: DashboardPerformanceViewProps['heatmap'];
    confidenceCalibration?: DashboardPerformanceViewProps['confidenceCalibration'];
  };
  sessionConfidenceBreakdown?: DashboardPerformanceViewProps['sessionConfidenceBreakdown'];
};
type DashboardPayloadByView = {
  sessions: DashboardSessionsPayload;
  performance: DashboardPerformancePayload;
};

function getViewFromLocation(): DashboardView {
  if (typeof window === 'undefined') {
    return 'sessions';
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'performance' ? 'performance' : 'sessions';
}

export function DashboardViewShell({
  initialView,
  sessionsProps,
  performanceProps,
  initialLoadedViews,
}: DashboardViewShellProps) {
  const [view, setView] = useState<DashboardView>(initialView);
  const [resolvedSessionsProps, setResolvedSessionsProps] =
    useState(sessionsProps);
  const [resolvedPerformanceProps, setResolvedPerformanceProps] =
    useState(performanceProps);
  const [loadedViews, setLoadedViews] = useState(initialLoadedViews);
  const loadingViewRef = useRef<DashboardView | null>(null);
  const loadedViewsRef = useRef(initialLoadedViews);
  const visibleViewRef = useRef(initialView);
  const lastVisibleRevalidationRef = useRef(0);

  const applyPayload = useCallback(
    <TView extends DashboardView>(
      nextView: TView,
      payload: DashboardPayloadByView[TView] | null,
    ) => {
      if (!payload?.ok) {
        return;
      }

      if (nextView === 'sessions') {
        const sessionsPayload = payload as DashboardSessionsPayload;
        setResolvedSessionsProps((current) => ({
          ...current,
          groups: sessionsPayload.groups ?? [],
          sessions: sessionsPayload.sessions ?? [],
        }));
      } else {
        const performancePayload = payload as DashboardPerformancePayload;
        setResolvedPerformanceProps((current) => ({
          ...current,
          answeredCount: performancePayload.metrics?.answeredCount ?? 0,
          completedSessionsCount:
            performancePayload.metrics?.completedSessionsCount ?? 0,
          successRate: performancePayload.metrics?.successRate ?? null,
          averageConfidence:
            performancePayload.metrics?.averageConfidence ?? null,
          heatmap: performancePayload.profileAnalytics?.heatmap ?? [],
          confidenceCalibration:
            performancePayload.profileAnalytics?.confidenceCalibration ?? [],
          sessionConfidenceBreakdown:
            performancePayload.sessionConfidenceBreakdown ?? [],
        }));
      }

      setLoadedViews((current) => ({
        ...current,
        [nextView]: true,
      }));
    },
    [],
  );

  useEffect(() => {
    setView(initialView);
    visibleViewRef.current = initialView;
  }, [initialView]);

  useEffect(() => {
    loadedViewsRef.current = loadedViews;
  }, [loadedViews]);

  useEffect(() => {
    visibleViewRef.current = view;
  }, [view]);

  useEffect(() => {
    setResolvedSessionsProps(sessionsProps);
    setResolvedPerformanceProps(performanceProps);
    setLoadedViews(initialLoadedViews);
    if (initialLoadedViews.sessions) {
      seedDashboardPayload<DashboardPayloadByView, 'sessions'>('sessions', {
        ok: true,
        groups: sessionsProps.groups,
        sessions: sessionsProps.sessions,
      });
    }
    if (initialLoadedViews.performance) {
      seedDashboardPayload<DashboardPayloadByView, 'performance'>(
        'performance',
        {
          ok: true,
          metrics: {
            answeredCount: performanceProps.answeredCount,
            completedSessionsCount: performanceProps.completedSessionsCount,
            successRate: performanceProps.successRate,
            averageConfidence: performanceProps.averageConfidence,
          },
          profileAnalytics: {
            heatmap: performanceProps.heatmap,
            confidenceCalibration: performanceProps.confidenceCalibration,
          },
          sessionConfidenceBreakdown:
            performanceProps.sessionConfidenceBreakdown,
        },
      );
    }
  }, [initialLoadedViews, performanceProps, sessionsProps]);

  useEffect(() => {
    const staleViews = consumeDashboardPayloadStale();
    if (staleViews.length === 0) {
      return;
    }

    for (const staleView of staleViews) {
      invalidateDashboardPayloadCache(staleView);
      void fetchDashboardPayload<DashboardPayloadByView, typeof staleView>(
        staleView,
      ).then((payload) => {
        applyPayload(staleView, payload);
      });
    }
  }, [applyPayload]);

  useEffect(() => {
    function handleDashboardView(event: Event) {
      const detail = (event as CustomEvent<{ view?: DashboardView }>).detail;
      const nextView =
        detail?.view === 'performance' ? 'performance' : 'sessions';
      setView(nextView);
      visibleViewRef.current = nextView;
    }

    function handleDashboardPrefetch(event: Event) {
      const detail = (event as CustomEvent<{ view?: DashboardView }>).detail;
      const nextView =
        detail?.view === 'performance' ? 'performance' : 'sessions';
      if (loadedViewsRef.current[nextView]) {
        return;
      }

      void fetchDashboardPayload<DashboardPayloadByView, typeof nextView>(
        nextView,
      ).then((payload) => {
        applyPayload(nextView, payload);
      });
    }

    function handleDashboardInvalidate(event: Event) {
      const detail = (event as CustomEvent<{ view?: DashboardView }>).detail;
      invalidateDashboardPayloadCache(detail?.view);
      const viewsToReload: DashboardView[] = detail?.view
        ? [detail.view]
        : ['sessions', 'performance'];

      for (const nextView of viewsToReload) {
        if (!loadedViewsRef.current[nextView]) {
          continue;
        }

        void fetchDashboardPayload<DashboardPayloadByView, typeof nextView>(
          nextView,
        ).then((payload) => {
          applyPayload(nextView, payload);
        });
      }
    }

    function handlePopState() {
      const nextView = getViewFromLocation();
      setView(nextView);
      visibleViewRef.current = nextView;
    }

    window.addEventListener(
      'activeboard:dashboard-view',
      handleDashboardView as EventListener,
    );
    window.addEventListener(
      'activeboard:dashboard-prefetch',
      handleDashboardPrefetch as EventListener,
    );
    window.addEventListener(
      'activeboard:dashboard-invalidate',
      handleDashboardInvalidate as EventListener,
    );
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener(
        'activeboard:dashboard-view',
        handleDashboardView as EventListener,
      );
      window.removeEventListener(
        'activeboard:dashboard-prefetch',
        handleDashboardPrefetch as EventListener,
      );
      window.removeEventListener(
        'activeboard:dashboard-invalidate',
        handleDashboardInvalidate as EventListener,
      );
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyPayload]);

  useEffect(() => {
    function revalidateVisibleView() {
      if (document.visibilityState === 'hidden') {
        return;
      }
      const now = Date.now();
      if (now - lastVisibleRevalidationRef.current < 10_000) {
        return;
      }

      const currentView = visibleViewRef.current;
      lastVisibleRevalidationRef.current = now;
      void fetchDashboardPayload<DashboardPayloadByView, typeof currentView>(
        currentView,
      ).then((payload) => {
        applyPayload(currentView, payload);
      });
    }

    window.addEventListener('focus', revalidateVisibleView);
    document.addEventListener('visibilitychange', revalidateVisibleView);

    return () => {
      window.removeEventListener('focus', revalidateVisibleView);
      document.removeEventListener('visibilitychange', revalidateVisibleView);
    };
  }, [applyPayload]);

  useEffect(() => {
    if (loadedViews[view]) {
      return;
    }

    let cancelled = false;
    loadingViewRef.current = view;
    const loadView = async () => {
      const payload = await fetchDashboardPayload<
        DashboardPayloadByView,
        typeof view
      >(view);

      if (cancelled || loadingViewRef.current !== view) {
        return;
      }

      applyPayload(view, payload);
    };

    void loadView();

    return () => {
      cancelled = true;
      if (loadingViewRef.current === view) {
        loadingViewRef.current = null;
      }
    };
  }, [applyPayload, loadedViews, view]);

  return (
    <>
      <div hidden={view !== 'sessions'}>
        {loadedViews.sessions ? (
          <DashboardSessionsView {...resolvedSessionsProps} />
        ) : (
          <DashboardSkeleton />
        )}
      </div>
      <div hidden={view !== 'performance'}>
        {loadedViews.performance ? (
          <DashboardPerformanceView {...resolvedPerformanceProps} />
        ) : (
          <DashboardSkeleton />
        )}
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-36 animate-pulse rounded-[8px] bg-white/[0.04]" />
      <div className="h-28 animate-pulse rounded-[8px] bg-white/[0.04]" />
    </div>
  );
}
