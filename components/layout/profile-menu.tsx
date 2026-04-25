'use client';

import { BookOpen, CreditCard, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type ProfileMenuProps = {
  initials: string;
  name: string;
  email: string;
  isCaptain?: boolean;
  profileHref?: string | null;
  profileLabel?: string | null;
  examHref?: string | null;
  examLabel?: string | null;
  billingHref?: string | null;
  billingLabel?: string | null;
};

export function ProfileMenu({
  initials,
  name,
  email,
  isCaptain = false,
  profileHref,
  profileLabel,
  examHref,
  examLabel,
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
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-full border border-[#176b55] bg-[#053b32] text-[11px] font-extrabold text-[#22e39c] shadow-[inset_0_0_0_1px_rgba(34,227,156,0.14)] transition hover:bg-[#07483d]',
          open && 'ring-2 ring-white/70',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {initials}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#030712] bg-brand" />
        {isCaptain ? (
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-extrabold uppercase leading-none text-[#3b2600]">
            c
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(280px,calc(100vw-1rem))] overflow-hidden rounded-[12px] border border-white/[0.08] bg-[#11192c] shadow-[0_20px_70px_rgba(0,0,0,0.5)]">
          <div className="px-4 py-4">
            <p className="truncate text-base font-extrabold text-white">{name}</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">{email}</p>
          </div>
          <div className="border-t border-white/[0.06] py-1">
            {profileHref && profileLabel ? (
              <Link
                href={profileHref}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <User className="h-4 w-4 text-slate-500" aria-hidden="true" strokeWidth={1.7} />
                <span>{profileLabel}</span>
              </Link>
            ) : null}

            {examHref && examLabel ? (
              <Link
                href={examHref}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <BookOpen className="h-4 w-4 text-slate-500" aria-hidden="true" strokeWidth={1.7} />
                <span>{examLabel}</span>
              </Link>
            ) : null}

            {billingHref && billingLabel ? (
              <Link
                href={billingHref}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <CreditCard className="h-4 w-4 text-slate-500" aria-hidden="true" strokeWidth={1.7} />
                <span>{billingLabel}</span>
              </Link>
            ) : null}

            <div className="px-1 pb-1 pt-1">
              <LogoutButton
                showIcon
                className="flex w-full items-center justify-start gap-3 rounded-[10px] border-none bg-transparent px-3 py-3 text-sm font-bold text-[#ff4d5e] shadow-none transition hover:bg-white/[0.05] hover:text-[#ff7a86]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
