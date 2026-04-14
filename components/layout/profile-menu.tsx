'use client';

import { CreditCard, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { LogoutButton } from '@/components/auth/logout-button';
import { cn } from '@/lib/utils';

type ProfileMenuProps = {
  initials: string;
  name: string;
  email: string;
  profileHref?: string | null;
  profileLabel?: string | null;
  billingHref?: string | null;
  billingLabel?: string | null;
  groupHref?: string | null;
  groupLabel: string;
  groupHint?: string | null;
};

export function ProfileMenu({
  initials,
  profileHref,
  profileLabel,
  billingHref,
  billingLabel,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold text-white transition hover:bg-white/[0.1]',
          open && 'bg-white/[0.1]',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {initials}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[184px] rounded-[14px] border border-white/[0.08] bg-[#11192c] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <div className="space-y-1">
            {profileHref && profileLabel ? (
              <a
                href={profileHref}
                className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <User className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>{profileLabel}</span>
              </a>
            ) : null}

            {billingHref && billingLabel ? (
              <a
                href={billingHref}
                className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <CreditCard className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>{billingLabel}</span>
              </a>
            ) : null}

            <div className="border-t border-white/[0.06] pt-1">
              <LogoutButton
                showIcon
                className="w-full justify-start gap-2 rounded-[10px] border-none bg-transparent px-3 py-2 text-sm font-medium text-rose-400 hover:bg-white/[0.05] hover:text-rose-300"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
