'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getBrowserEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getBrowserEnv();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
