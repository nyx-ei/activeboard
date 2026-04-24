'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getBrowserEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let browserSupabaseClient: BrowserSupabaseClient | undefined;

export function createSupabaseBrowserClient() {
  if (browserSupabaseClient !== undefined) {
    return browserSupabaseClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getBrowserEnv();

  browserSupabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
      timeout: 10_000,
      heartbeatIntervalMs: 15_000,
      reconnectAfterMs(tries: number) {
        if (tries <= 1) return 1_000;
        if (tries === 2) return 2_000;
        if (tries === 3) return 4_000;
        return 8_000;
      },
    },
  });

  return browserSupabaseClient;
}
