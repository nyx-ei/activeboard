'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

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

    const channel = supabase.channel(channelName);
    const parsedTables = JSON.parse(tablesKey) as RealtimeTable[];

    for (const item of parsedTables) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: item.table,
          filter: item.filter,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [channelName, router, supabase, tablesKey, throttleMs]);

  return null;
}
