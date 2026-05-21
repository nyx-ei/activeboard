'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DashboardPerformanceViewProps } from '@/components/dashboard/dashboard-performance-view';
import {
  DashboardGroupZone,
  type DashboardGroupZoneProps,
} from '@/components/dashboard/dashboard-group-zone';
import {
  DashboardSprintActivityZone,
  type DashboardSprintActivityZoneProps,
} from '@/components/dashboard/dashboard-sprint-activity-zone';
import {
  DashboardProgressStateZone,
  type DashboardProgressStateZoneProps,
} from '@/components/dashboard/dashboard-progress-state-zone';
import {
  fetchDashboardPayload,
  consumeDashboardPayloadStale,
  invalidateDashboardPayloadCache,
  seedDashboardPayload,
  type DashboardView,
} from '@/components/dashboard/dashboard-data-cache';
import type { DashboardSessionsViewProps } from '@/components/dashboard/dashboard-sessions-view';
import { subscribeSessionTabRecovery } from '@/components/session/session-tab-channel';
import { CreateSessionModal } from '@/components/sessions/create-session-modal';

type DashboardViewShellProps = {
  sessionsProps: DashboardSessionsViewProps;
  performanceProps: DashboardPerformanceViewProps;
  sprintActivityProps: DashboardSprintActivityZoneProps;
  progressStateProps: DashboardProgressStateZoneProps;
  groupZoneProps: DashboardGroupZoneProps;
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
    blueprintGrid?: DashboardPerformanceViewProps['blueprintGrid'];
    errorTypeBreakdown?: DashboardPerformanceViewProps['errorTypeBreakdown'];
    weeklyTrend?: DashboardPerformanceViewProps['weeklyTrend'];
    confidenceCalibration?: DashboardPerformanceViewProps['confidenceCalibration'];
  };
  sessionConfidenceBreakdown?: DashboardPerformanceViewProps['sessionConfidenceBreakdown'];
  progressQuadrants?: DashboardProgressStateZoneProps['quadrants'];
  progressQuadrantQuestions?: DashboardPerformanceViewProps['progressQuadrantQuestions'];
};
type DashboardPayloadByView = {
  sessions: DashboardSessionsPayload;
  performance: DashboardPerformancePayload;
};

const LIVE_SESSION_REVALIDATION_INTERVAL_MS = 15_000;
const PERFORMANCE_REVALIDATION_INTERVAL_MS = 30_000;

export function DashboardViewShell({
  sessionsProps,
  performanceProps,
  sprintActivityProps,
  progressStateProps,
  groupZoneProps,
}: DashboardViewShellProps) {
  const [resolvedSessionsProps, setResolvedSessionsProps] =
    useState(sessionsProps);
  const [resolvedSprintActivityProps, setResolvedSprintActivityProps] =
    useState(sprintActivityProps);
  const [resolvedProgressStateProps, setResolvedProgressStateProps] =
    useState(progressStateProps);
  const [resolvedGroupZoneProps, setResolvedGroupZoneProps] =
    useState(groupZoneProps);
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
        setResolvedGroupZoneProps((current) => ({
          ...current,
          groups: sessionsPayload.groups ?? [],
        }));
      } else {
        const performancePayload = payload as DashboardPerformancePayload;
        setResolvedSprintActivityProps((current) => ({
          ...current,
          answeredCount: performancePayload.metrics?.answeredCount ?? 0,
          completedSessionsCount:
            performancePayload.metrics?.completedSessionsCount ?? 0,
          trueMastery: performancePayload.metrics?.successRate ?? null,
          heatmap: performancePayload.profileAnalytics?.heatmap ?? [],
        }));
        setResolvedProgressStateProps((current) => ({
          ...current,
          quadrants: performancePayload.progressQuadrants ?? [],
        }));
      }
    },
    [],
  );

  useEffect(() => {
    setResolvedSessionsProps(sessionsProps);
    setResolvedSprintActivityProps(sprintActivityProps);
    setResolvedProgressStateProps(progressStateProps);
    setResolvedGroupZoneProps(groupZoneProps);
    seedDashboardPayload<DashboardPayloadByView, 'sessions'>('sessions', {
      ok: true,
      groups: sessionsProps.groups,
      sessions: sessionsProps.sessions,
    });
    seedDashboardPayload<DashboardPayloadByView, 'performance'>('performance', {
      ok: true,
      metrics: {
        answeredCount: performanceProps.answeredCount,
        completedSessionsCount: performanceProps.completedSessionsCount,
        successRate: performanceProps.successRate,
        averageConfidence: performanceProps.averageConfidence,
      },
      profileAnalytics: {
        heatmap: performanceProps.heatmap,
        blueprintGrid: performanceProps.blueprintGrid,
        errorTypeBreakdown: performanceProps.errorTypeBreakdown,
        weeklyTrend: performanceProps.weeklyTrend,
        confidenceCalibration: performanceProps.confidenceCalibration,
      },
      sessionConfidenceBreakdown: performanceProps.sessionConfidenceBreakdown,
      progressQuadrants: progressStateProps.quadrants,
      progressQuadrantQuestions: performanceProps.progressQuadrantQuestions,
    });
  }, [
    groupZoneProps,
    performanceProps,
    progressStateProps,
    sessionsProps,
    sprintActivityProps,
  ]);

  const reloadDashboardData = useCallback(
    (views: DashboardView[] = ['sessions', 'performance']) => {
      for (const nextView of views) {
        void fetchDashboardPayload<DashboardPayloadByView, typeof nextView>(
          nextView,
        ).then((payload) => {
          applyPayload(nextView, payload);
        });
      }
    },
    [applyPayload],
  );

  useEffect(() => {
    const staleViews = consumeDashboardPayloadStale();
    if (staleViews.length === 0) {
      return;
    }

    for (const staleView of staleViews) {
      invalidateDashboardPayloadCache(staleView);
      reloadDashboardData([staleView]);
    }
  }, [reloadDashboardData]);

  useEffect(() => {
    function handleDashboardInvalidate(event: Event) {
      const detail = (event as CustomEvent<{ view?: DashboardView }>).detail;
      invalidateDashboardPayloadCache(detail?.view);
      const viewsToReload: DashboardView[] = detail?.view
        ? [detail.view]
        : ['sessions', 'performance'];

      reloadDashboardData(viewsToReload);
    }

    window.addEventListener(
      'activeboard:dashboard-invalidate',
      handleDashboardInvalidate as EventListener,
    );

    return () => {
      window.removeEventListener(
        'activeboard:dashboard-invalidate',
        handleDashboardInvalidate as EventListener,
      );
    };
  }, [reloadDashboardData]);

  useEffect(() => {
    function revalidateVisibleView() {
      if (document.visibilityState === 'hidden') {
        return;
      }
      const now = Date.now();
      if (now - lastVisibleRevalidationRef.current < 10_000) {
        return;
      }

      lastVisibleRevalidationRef.current = now;
      reloadDashboardData();
    }

    window.addEventListener('focus', revalidateVisibleView);
    document.addEventListener('visibilitychange', revalidateVisibleView);

    return () => {
      window.removeEventListener('focus', revalidateVisibleView);
      document.removeEventListener('visibilitychange', revalidateVisibleView);
    };
  }, [reloadDashboardData]);

  useEffect(() => {
    return subscribeSessionTabRecovery(() => {
      invalidateDashboardPayloadCache('sessions');
      invalidateDashboardPayloadCache('performance');
      reloadDashboardData(['sessions', 'performance']);
    });
  }, [reloadDashboardData]);

  useEffect(() => {
    let cancelled = false;

    const intervalId = window.setInterval(() => {
      if (cancelled || document.visibilityState === 'hidden') {
        return;
      }

      void fetchDashboardPayload<DashboardPayloadByView, 'sessions'>(
        'sessions',
      ).then((payload) => {
        if (!cancelled) {
          applyPayload('sessions', payload);
        }
      });
    }, LIVE_SESSION_REVALIDATION_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyPayload]);

  useEffect(() => {
    let cancelled = false;

    const intervalId = window.setInterval(() => {
      if (cancelled || document.visibilityState === 'hidden') {
        return;
      }

      invalidateDashboardPayloadCache('performance');
      void fetchDashboardPayload<DashboardPayloadByView, 'performance'>(
        'performance',
      ).then((payload) => {
        if (!cancelled) {
          applyPayload('performance', payload);
        }
      });
    }, PERFORMANCE_REVALIDATION_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyPayload]);

  return (
    <div className="space-y-5">
      <DashboardSprintActivityZone {...resolvedSprintActivityProps} />
      <div className="hidden md:block">
        <DashboardProgressStateZone {...resolvedProgressStateProps} />
      </div>
      <DashboardGroupZone {...resolvedGroupZoneProps} />
      <DashboardSessionActionHost {...resolvedSessionsProps} />
    </div>
  );
}

function DashboardSessionActionHost({
  locale,
  groups,
  canCreateSession,
  createSessionAction,
  labels,
}: DashboardSessionsViewProps) {
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [createSessionGroupId, setCreateSessionGroupId] = useState<
    string | null
  >(null);
  const initialGroupId = useMemo(
    () => createSessionGroupId ?? groups[0]?.id ?? '',
    [createSessionGroupId, groups],
  );

  useEffect(() => {
    function handleOpenCreateSession(event: Event) {
      const detail = (event as CustomEvent<{ groupId?: string }>).detail;
      const requestedGroupId = detail?.groupId;
      const resolvedGroupId =
        requestedGroupId &&
        groups.some((group) => group.id === requestedGroupId)
          ? requestedGroupId
          : groups[0]?.id;

      if (!resolvedGroupId) {
        return;
      }

      setCreateSessionGroupId(resolvedGroupId);
      setIsCreateSessionOpen(true);
    }

    window.addEventListener(
      'activeboard:open-create-session',
      handleOpenCreateSession,
    );

    return () => {
      window.removeEventListener(
        'activeboard:open-create-session',
        handleOpenCreateSession,
      );
    };
  }, [groups]);

  if (!isCreateSessionOpen || groups.length === 0) {
    return null;
  }

  return (
    <CreateSessionModal
      key={initialGroupId}
      locale={locale}
      groups={groups}
      initialGroupId={initialGroupId}
      canCreateSession={canCreateSession}
      action={createSessionAction}
      labels={{
        newSession: labels.newSession,
        createSession: labels.createSession,
        createSessionPending: labels.createSessionPending,
        groupName: labels.groupName,
        sessionName: labels.sessionName,
        sessionNamePlaceholder: labels.sessionNamePlaceholder,
        questionCount: labels.questionCount,
        timerMode: labels.timerMode,
        perQuestionMode: labels.perQuestionMode,
        globalMode: labels.globalMode,
        timerSeconds: labels.timerSeconds,
        totalTimerSeconds: labels.totalTimerSeconds,
        modalHint: labels.modalHint,
        close: labels.close,
        groupAccessHint: labels.groupAccessHint,
      }}
      onClose={() => setIsCreateSessionOpen(false)}
    />
  );
}
