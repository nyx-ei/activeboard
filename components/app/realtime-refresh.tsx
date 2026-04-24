'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { registerRealtimeSubscription } from '@/lib/realtime/browser';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type RealtimeTable = {
  table: string;
  filter?: string;
};

type RealtimeRefreshProps = {
  channelName: string;
  tables: RealtimeTable[];
  throttleMs?: number;
};

export function RealtimeRefresh({ channelName, tables, throttleMs = 450 }: RealtimeRefreshProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) return;

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, throttleMs);
    };

    const parsedTables = JSON.parse(tablesKey) as RealtimeTable[];
    const release = registerRealtimeSubscription({
      supabase,
      channelName,
      tables: parsedTables,
      onEvent: scheduleRefresh,
    });

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void release();
    };
  }, [channelName, router, supabase, tablesKey, throttleMs]);

  return null;
}
