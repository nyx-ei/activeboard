'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';

export function SessionDashboardBackButton({
  locale,
  label,
  variant = 'icon',
}: {
  locale: string;
  label?: string;
  variant?: 'icon' | 'text';
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const href = `/${locale}/dashboard?view=sessions`;

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.prefetch(href as never);
    }, 250);

    return () => window.clearTimeout(id);
  }, [href, router]);

  const goBack = () => {
    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    window.sessionStorage.removeItem('activeboard:session-flow-active');
    markDashboardPayloadStale('sessions');
    router.prefetch(href as never);
    router.replace(href as never);
  };

  if (variant === 'text') {
    return (
      <button
        type="button"
        disabled={isNavigating}
        onClick={goBack}
        onPointerEnter={() => router.prefetch(href as never)}
        className="button-ghost mt-4 px-4 py-2 text-sm text-slate-500 disabled:cursor-wait disabled:opacity-70"
        aria-busy={isNavigating}
      >
        {isNavigating ? (label ?? '') : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isNavigating}
      onClick={goBack}
      onPointerEnter={() => router.prefetch(href as never)}
      className="inline-flex h-7 w-7 items-center justify-start text-slate-500 hover:text-white disabled:cursor-wait disabled:opacity-70 sm:h-10 sm:w-10"
      aria-label={label}
      aria-busy={isNavigating}
    >
      {isNavigating ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
