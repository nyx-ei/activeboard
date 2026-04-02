import { createClient } from '@supabase/supabase-js';

import { getSupabaseAdminEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

let supabaseAdminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseAdminEnv();

  supabaseAdminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
}
