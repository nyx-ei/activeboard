'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Menu, User, Users } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type ShellGroup = {
  id: string;
  name: string;
};

type GroupSwitcherMenuProps = {
  groups: ShellGroup[];
  labels: {
    group: string;
    profile: string;
    billing: string;
  };
};

export function GroupSwitcherMenu({ groups, labels }: GroupSwitcherMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const selectedGroupId = searchParams.get('groupId');
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-[8px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white',
          open && 'bg-white/[0.08] text-white',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.9} />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[238px] overflow-hidden rounded-[12px] border border-white/[0.08] bg-[#11192c] shadow-[0_20px_70px_rgba(0,0,0,0.5)]">
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{labels.group}</p>
            <p className="mt-1 truncate text-sm font-extrabold text-white">{selectedGroup?.name ?? 'ActiveBoard'}</p>
          </div>

          <div className="max-h-[176px] overflow-y-auto">
            {groups.map((group) => {
              const active = group.id === selectedGroup?.id;
              return (
                <Link
                  key={group.id}
                  href={`/dashboard?view=sessions&groupId=${group.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm font-semibold transition',
                    active ? 'bg-brand/12 text-brand' : 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
                  )}
                >
                  <Users className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={1.7} />
                  <span className="truncate">{group.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="border-t border-white/[0.06] py-1">
            <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white">
              <User className="h-4 w-4 text-slate-500" aria-hidden="true" strokeWidth={1.6} />
              {labels.profile}
            </Link>
            <Link href="/billing" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white">
              <CreditCard className="h-4 w-4 text-slate-500" aria-hidden="true" strokeWidth={1.6} />
              {labels.billing}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
