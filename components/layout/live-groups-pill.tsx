'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

import { Link } from '@/i18n/navigation';

export function LiveGroupsPill({
  href,
  label,
  canBrowseLookupLayer,
  initialCount = 0,
}: {
  href: string;
  label: string;
  canBrowseLookupLayer: boolean;
  initialCount?: number;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    if (!canBrowseLookupLayer) {
      setCount(0);
      return;
    }

    const controller = new AbortController();

    void fetch('/api/live-groups/count', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as { ok?: boolean; count?: number } | null;
      })
      .then((payload) => {
        if (payload?.ok && typeof payload.count === 'number') {
          setCount(payload.count);
        }
      })
      .catch(() => {
        // Non-critical shell hint. Ignore transient failures.
      });

    return () => controller.abort();
  }, [canBrowseLookupLayer]);

  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-amber-500/10 px-3 text-xs font-extrabold text-amber-400 ring-1 ring-amber-500/10 transition hover:bg-amber-500/15"
      aria-label={`${label} ${count}`}
    >
      <Lock className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />
      {count}
    </Link>
  );
}
