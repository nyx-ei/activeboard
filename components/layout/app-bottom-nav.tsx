'use client';

import { BarChart3, Play, Users, type LucideIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type AppBottomNavProps = {
  locale: string;
  showGroupTab?: boolean;
  groupsHref?: string;
  labels: {
    sessions: string;
    performance: string;
    group: string;
  };
};

type NavItem = {
  key: 'sessions' | 'performance' | 'group';
  href: string;
  Icon: LucideIcon;
};
function getDashboardView(value: string | null): 'sessions' | 'performance' {
  return value === 'performance' ? 'performance' : 'sessions';
}

function normalizePathname(pathname: string, locale: string) {
  if (pathname === `/${locale}`) {
    return '/';
  }

  if (pathname.startsWith(`/${locale}/`)) {
    return pathname.slice(locale.length + 1) || '/';
  }

  return pathname;
}

export function AppBottomNav({
  locale,
  showGroupTab = true,
  groupsHref = '/groups',
  labels,
}: AppBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingTargetKey, setPendingTargetKey] = useState<
    NavItem['key'] | null
  >(null);
  const dashboardView = getDashboardView(searchParams.get('view'));
  const [optimisticDashboardView, setOptimisticDashboardView] = useState<
    'sessions' | 'performance'
  >(dashboardView);
  const normalizedPathname = normalizePathname(pathname, locale);
  const isDashboardPath = normalizedPathname === '/dashboard';
  const isGroupsPath =
    normalizedPathname === '/groups' ||
    normalizedPathname.startsWith('/groups/');
  const isSessionPath = normalizedPathname.startsWith('/sessions/');
  const items = useMemo<NavItem[]>(() => {
    const nextItems: NavItem[] = [
      {
        key: 'sessions',
        href: '/dashboard?view=sessions',
        Icon: Play,
      },
      {
        key: 'performance',
        href: '/dashboard?view=performance',
        Icon: BarChart3,
      },
    ];

    if (showGroupTab) {
      nextItems.push({
        key: 'group',
        href: groupsHref,
        Icon: Users,
      });
    }

    return nextItems;
  }, [groupsHref, showGroupTab]);

  useEffect(() => {
    if (!isSessionPath) {
      window.sessionStorage.removeItem('activeboard:session-flow-active');
    }
  }, [isSessionPath]);

  useEffect(() => {
    setPendingTargetKey(null);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (isDashboardPath) {
      setOptimisticDashboardView(dashboardView);
    }
  }, [dashboardView, isDashboardPath]);

  useEffect(() => {
    function handleDashboardView(event: Event) {
      const detail = (
        event as CustomEvent<{ view?: 'sessions' | 'performance' }>
      ).detail;
      setOptimisticDashboardView(
        detail?.view === 'performance' ? 'performance' : 'sessions',
      );
      setPendingTargetKey(null);
    }

    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      setOptimisticDashboardView(
        params.get('view') === 'performance' ? 'performance' : 'sessions',
      );
      setPendingTargetKey(null);
    }

    window.addEventListener(
      'activeboard:dashboard-view',
      handleDashboardView as EventListener,
    );
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener(
        'activeboard:dashboard-view',
        handleDashboardView as EventListener,
      );
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const openDashboardView = useCallback(
    (nextView: 'sessions' | 'performance') => {
      const nextHref = `/${locale}/dashboard?view=${nextView}`;
      setOptimisticDashboardView(nextView);
      window.history.pushState({}, '', nextHref);
      window.dispatchEvent(
        new CustomEvent('activeboard:dashboard-view', {
          detail: { view: nextView },
        }),
      );
    },
    [locale],
  );

  const prefetchIfRouteChange = useCallback(
    (item: NavItem) => {
      if (isDashboardPath && item.key !== 'group') {
        return;
      }

      router.prefetch(item.href);
    },
    [isDashboardPath, router],
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a16]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:px-3 sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div
        className={cn(
          'mx-auto grid max-w-[520px] gap-1',
          showGroupTab ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {items.map((item) => {
          const Icon = item.Icon;
          const active =
            item.key === 'group'
              ? isGroupsPath
              : isDashboardPath && optimisticDashboardView === item.key;
          const busy = pendingTargetKey === item.key && !active;
          const className = cn(
            'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[10px] border px-1.5 text-[10px] font-medium transition sm:text-[11px]',
            active &&
              'border-brand/80 bg-brand/[0.12] text-brand shadow-[inset_0_0_0_1px_rgba(16,185,129,0.42),0_0_18px_rgba(16,185,129,0.12)]',
            !active &&
              'border-transparent text-slate-500 hover:border-brand/35 hover:bg-brand/[0.04] hover:text-brand',
            busy &&
              'border-brand/45 bg-brand/[0.07] text-brand/90 opacity-90',
          );

          if (active) {
            return (
              <div key={item.key} aria-current="page" className={className}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{labels[item.key]}</span>
              </div>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              className={className}
              aria-busy={busy || undefined}
              onMouseEnter={() => prefetchIfRouteChange(item)}
              onTouchStart={() => prefetchIfRouteChange(item)}
              onClick={() => {
                if (isDashboardPath && item.key !== 'group') {
                  openDashboardView(item.key);
                  return;
                }

                setPendingTargetKey(item.key);
                if (item.key === 'sessions' || item.key === 'performance') {
                  setOptimisticDashboardView(item.key);
                }
                prefetchIfRouteChange(item);
                startTransition(() => {
                  router.push(item.href);
                });
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{labels[item.key]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
