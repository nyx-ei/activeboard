'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type SessionAutoRefreshProps = {
  intervalMs?: number;
  enabled?: boolean;
};

export function SessionAutoRefresh({ intervalMs = 5000, enabled = true }: SessionAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (document.visibilityState !== 'visible') {
      return undefined;
    }

    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
