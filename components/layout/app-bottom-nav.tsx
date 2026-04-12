'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type AppBottomNavProps = {
  locale: string;
  labels: {
    sessions: string;
    performance: string;
    group: string;
    settings: string;
  };
};

const items = [
  {
    key: 'sessions',
    href: '/dashboard?view=sessions',
    icon: (
      <path
        d="M8 5.5v13l10-6.5L8 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
  },
  {
    key: 'performance',
    href: '/dashboard?view=performance',
    icon: (
      <path
        d="M5 18.5V9.5M10 18.5V5.5M15 18.5v-7M20 18.5V7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    ),
  },
  {
    key: 'group',
    href: '/dashboard?view=group',
    icon: (
      <path
        d="M7.5 18.5v-.7A3.3 3.3 0 0 1 10.8 14.5h2.4a3.3 3.3 0 0 1 3.3 3.3v.7M12 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6ZM18.4 13.5a2.4 2.4 0 0 1 2.1 2.4v.5M5.6 13.5a2.4 2.4 0 0 0-2.1 2.4v.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    ),
  },
  {
    key: 'settings',
    href: '/dashboard?view=settings',
    icon: (
      <>
        <path
          d="M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 0 0 0-6.4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19 12a6.2 6.2 0 0 0-.1-1l1.8-1.3l-1.8-3.1l-2.1.9a6.8 6.8 0 0 0-1.7-1l-.4-2.2h-3.6l-.4 2.2a6.8 6.8 0 0 0-1.7 1l-2.1-.9l-1.8 3.1L5 11a6.2 6.2 0 0 0 0 2l-1.8 1.3l1.8 3.1l2.1-.9a6.8 6.8 0 0 0 1.7 1l.4 2.2h3.6l.4-2.2a6.8 6.8 0 0 0 1.7-1l2.1.9l1.8-3.1L18.9 13c.1-.3.1-.7.1-1Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.3"
        />
      </>
    ),
  },
] as const;

export function AppBottomNav({ locale, labels }: AppBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dashboardView = searchParams.get('view') ?? 'sessions';
  const isDashboardPath = pathname === `/${locale}/dashboard` || pathname === '/dashboard';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a16]/95 px-3 pb-3 pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[520px] grid-cols-4 gap-1">
        {items.map((item) => {
          const isDashboardItem = item.key !== 'settings';
          const active = isDashboardItem
            ? isDashboardPath && dashboardView === item.key
            : isDashboardPath && dashboardView === 'settings';

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
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                {item.icon}
              </svg>
              <span>{labels[item.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
