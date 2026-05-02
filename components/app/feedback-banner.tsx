'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type FeedbackBannerProps = {
  message?: string | null;
  tone?: string | null;
  feedbackId?: string | null;
};

export function FeedbackBanner({ message, tone, feedbackId }: FeedbackBannerProps) {
  const [clientFeedback, setClientFeedback] = useState<{
    message: string;
    tone: string;
    id: string;
  } | null>(null);
  const resolvedMessage = clientFeedback?.message ?? message;
  const resolvedTone = clientFeedback?.tone ?? tone;
  const resolvedFeedbackId = clientFeedback?.id ?? feedbackId;
  const [visible, setVisible] = useState(Boolean(resolvedMessage));

  useEffect(() => {
    setVisible(Boolean(resolvedMessage));

    if (!resolvedMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setVisible(false), 3200);

    return () => window.clearTimeout(timeout);
  }, [resolvedFeedbackId, resolvedMessage]);

  useEffect(() => {
    function handleFeedback(event: Event) {
      const detail = (
        event as CustomEvent<{ message?: string; tone?: string; id?: string }>
      ).detail;

      if (!detail?.message) {
        return;
      }

      setClientFeedback({
        message: detail.message,
        tone: detail.tone === 'success' ? 'success' : 'error',
        id: detail.id ?? String(Date.now()),
      });
    }

    window.addEventListener(
      'activeboard:feedback',
      handleFeedback as EventListener,
    );

    return () => {
      window.removeEventListener(
        'activeboard:feedback',
        handleFeedback as EventListener,
      );
    };
  }, []);

  if (!resolvedMessage || !visible) {
    return null;
  }

  const isSuccess = resolvedTone === 'success';

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
      {resolvedMessage}
    </div>
  );
}
