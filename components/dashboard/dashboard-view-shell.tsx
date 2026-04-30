'use client';

import { useEffect, useState } from 'react';

import { DashboardPerformanceView } from '@/components/dashboard/dashboard-performance-view';
import { DashboardSessionsView } from '@/components/dashboard/dashboard-sessions-view';

type DashboardView = 'sessions' | 'performance';

type DashboardViewShellProps = {
  initialView: DashboardView;
  sessionsProps: React.ComponentProps<typeof DashboardSessionsView>;
  performanceProps: React.ComponentProps<typeof DashboardPerformanceView>;
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
}: DashboardViewShellProps) {
  const [view, setView] = useState<DashboardView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    function handleDashboardView(event: Event) {
      const detail = (event as CustomEvent<{ view?: DashboardView }>).detail;
      const nextView = detail?.view === 'performance' ? 'performance' : 'sessions';
      setView(nextView);
    }

    function handlePopState() {
      setView(getViewFromLocation());
    }

    window.addEventListener('activeboard:dashboard-view', handleDashboardView as EventListener);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('activeboard:dashboard-view', handleDashboardView as EventListener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return view === 'performance' ? (
    <DashboardPerformanceView {...performanceProps} />
  ) : (
    <DashboardSessionsView {...sessionsProps} />
  );
}
