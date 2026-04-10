'use client';

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
  name,
  email,
  profileHref,
  profileLabel,
  billingHref,
  billingLabel,
  groupHref,
  groupLabel,
  groupHint,
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
        <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[272px] rounded-[22px] border border-border bg-[#141c32] p-4 shadow-panel">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/20 text-base font-bold text-brand">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-white">{name}</p>
              <p className="truncate text-sm text-slate-400">{email}</p>
            </div>
          </div>

          <div className="mt-4 border-t border-white/8 pt-4">
            {profileHref && profileLabel ? (
              <a
                href={profileHref}
                className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-base text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12 12a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7ZM5.5 19.5a6.5 6.5 0 0 1 13 0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
                <span>{profileLabel}</span>
              </a>
            ) : null}

            {billingHref && billingLabel ? (
              <a
                href={billingHref}
                className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-base text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 7.5h16M6 16.5h4M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
                <span>{billingLabel}</span>
              </a>
            ) : null}

            {groupHref ? (
              <div>
                <a
                  href={groupHref}
                  className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-base text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M19 12a7.6 7.6 0 0 0-.1-1.2l2-1.5l-2-3.4l-2.4 1a7.8 7.8 0 0 0-2-.9l-.4-2.6H9.9l-.4 2.6a7.8 7.8 0 0 0-2 .9l-2.4-1l-2 3.4l2 1.5A7.6 7.6 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5l2 3.4l2.4-1a7.8 7.8 0 0 0 2 .9l.4 2.6h4.2l.4-2.6a7.8 7.8 0 0 0 2-.9l2.4 1l2-3.4l-2-1.5c.1-.4.1-.8.1-1.2Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.4"
                    />
                  </svg>
                  <span>{groupLabel}</span>
                </a>
                {groupHint ? <p className="px-3 pt-1 text-xs leading-5 text-slate-500">{groupHint}</p> : null}
              </div>
            ) : null}

            <div className="mt-1">
              <LogoutButton
                showIcon
                className="w-full justify-start gap-3 rounded-[14px] border-none bg-transparent px-3 py-3 text-base text-rose-400 hover:bg-white/[0.04] hover:text-rose-300"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
