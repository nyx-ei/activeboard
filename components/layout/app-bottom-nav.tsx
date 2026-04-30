'use client';

import { BarChart3, Play, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
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

export function AppBottomNav({ locale, showGroupTab = true, groupsHref = '/groups', labels }: AppBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<NavItem['key'] | null>(null);
  const [optimisticDashboardView, setOptimisticDashboardView] = useState<'sessions' | 'performance'>('sessions');
  const dashboardView = searchParams.get('view') ?? 'sessions';
  const isDashboardPath = pathname === `/${locale}/dashboard` || pathname === '/dashboard';
  const isGroupsPath = pathname === `/${locale}/groups` || pathname.startsWith(`/${locale}/groups/`) || pathname === '/groups';
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
    setPendingKey(null);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (dashboardView === 'performance') {
      setOptimisticDashboardView('performance');
      return;
    }

    setOptimisticDashboardView('sessions');
  }, [dashboardView]);

  useEffect(() => {
    function handleDashboardView(event: Event) {
      const detail = (event as CustomEvent<{ view?: 'sessions' | 'performance' }>).detail;
      setOptimisticDashboardView(detail?.view === 'performance' ? 'performance' : 'sessions');
      setPendingKey(null);
    }

    window.addEventListener('activeboard:dashboard-view', handleDashboardView as EventListener);
    return () => {
      window.removeEventListener('activeboard:dashboard-view', handleDashboardView as EventListener);
    };
  }, []);

  useEffect(() => {
    const prefetchAll = () => {
      for (const item of items) {
        router.prefetch(item.href);
      }
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(() => prefetchAll());
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(prefetchAll, 0);
    return () => window.clearTimeout(timeoutId);
  }, [items, router]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a16]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:px-3 sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className={cn('mx-auto grid max-w-[520px] gap-1', showGroupTab ? 'grid-cols-3' : 'grid-cols-2')}>
        {items.map((item) => {
          const Icon = item.Icon;
          const active =
            pendingKey === item.key ||
            (item.key === 'group' ? isGroupsPath : isDashboardPath && optimisticDashboardView === item.key);
          const className = cn(
            'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[10px] border px-1.5 text-[10px] font-medium transition sm:text-[11px]',
            active && 'border-brand/80 bg-brand/[0.12] text-brand shadow-[inset_0_0_0_1px_rgba(16,185,129,0.42),0_0_18px_rgba(16,185,129,0.12)]',
            !active && 'border-transparent text-slate-500 hover:border-brand/35 hover:bg-brand/[0.04] hover:text-brand',
          );

          if (active) {
            return (
              <div
                key={item.key}
                aria-current="page"
                className={className}
              >
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
              disabled={isPending}
              onMouseEnter={() => router.prefetch(item.href)}
              onTouchStart={() => router.prefetch(item.href)}
              onClick={() => {
                if (isDashboardPath && item.key !== 'group') {
                  const nextHref = `/${locale}/dashboard?view=${item.key}`;
                  setOptimisticDashboardView(item.key);
                  setPendingKey(null);
                  window.history.pushState({}, '', nextHref);
                  window.dispatchEvent(new CustomEvent('activeboard:dashboard-view', { detail: { view: item.key } }));
                  return;
                }

                setPendingKey(item.key);
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
