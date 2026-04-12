'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type FeedbackBannerProps = {
  message?: string | null;
  tone?: string | null;
};

export function FeedbackBanner({ message, tone }: FeedbackBannerProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));

    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setVisible(false), 3200);

    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!message || !visible) {
    return null;
  }

  const isSuccess = tone === 'success';

  return (
    <div
      className={cn(
        'fixed bottom-24 right-4 z-[70] flex min-h-[52px] w-[min(320px,calc(100vw-2rem))] items-center gap-2 rounded-[4px] border bg-white px-4 py-3 text-sm font-extrabold text-slate-950 shadow-[0_18px_48px_rgba(0,0,0,0.32)]',
        isSuccess
          ? 'border-brand/25 before:bg-brand'
          : 'border-rose-500/25 before:bg-rose-500',
        'before:h-2 before:w-2 before:shrink-0 before:rounded-full',
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
