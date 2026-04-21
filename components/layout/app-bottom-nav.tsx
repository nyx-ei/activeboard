'use client';

import { BarChart3, Play, Users } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type AppBottomNavProps = {
  locale: string;
  labels: {
    sessions: string;
    performance: string;
    group: string;
  };
};

const items = [
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
  {
    key: 'group',
    href: '/groups',
    Icon: Users,
  },
] as const;

export function AppBottomNav({ locale, labels }: AppBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawDashboardView = searchParams.get('view') ?? 'sessions';
  const dashboardView = rawDashboardView === 'settings' ? 'group' : rawDashboardView;
  const isDashboardPath = pathname === `/${locale}/dashboard` || pathname === '/dashboard';
  const isGroupsPath = pathname === `/${locale}/groups` || pathname.startsWith(`/${locale}/groups/`) || pathname === '/groups';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a16]/95 px-3 pb-3 pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[520px] grid-cols-3 gap-1">
        {items.map((item) => {
          const Icon = item.Icon;
          const active = item.key === 'group' ? isGroupsPath || (isDashboardPath && dashboardView === 'group') : isDashboardPath && dashboardView === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[2px] border text-[11px] font-medium transition',
                active && 'border-brand/80 bg-brand/[0.12] text-brand shadow-[inset_0_0_0_1px_rgba(16,185,129,0.42),0_0_18px_rgba(16,185,129,0.12)]',
                !active && 'border-transparent text-slate-500 hover:border-brand/35 hover:bg-brand/[0.04] hover:text-brand',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{labels[item.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
