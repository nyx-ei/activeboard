'use client';

import { useEffect, useMemo } from 'react';

import { registerRealtimeSubscription } from '@/lib/realtime/browser';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SessionStateRealtimeSyncProps = {
  sessionId: string;
};

function dispatchSessionStateSync(sessionId: string) {
  window.dispatchEvent(
    new CustomEvent('activeboard:session-state-sync', {
      detail: { sessionId },
    }),
  );
}

export function SessionStateRealtimeSync({
  sessionId,
}: SessionStateRealtimeSyncProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const release = registerRealtimeSubscription({
      supabase,
      channelName: `session-state:${sessionId}`,
      tables: [
        {
          table: 'session_state_events',
          filter: `session_id=eq.${sessionId}`,
        },
        {
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
      ],
      onEvent: () => {
        dispatchSessionStateSync(sessionId);
      },
      onStatus: (status) => {
        if (status === 'SUBSCRIBED') {
          dispatchSessionStateSync(sessionId);
        }
      },
    });

    return () => {
      void release();
    };
  }, [sessionId, supabase]);

  return null;
}
