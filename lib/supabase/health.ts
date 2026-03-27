import { hasSupabaseEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type SupabaseHealth = {
  configured: boolean;
  reachable: boolean;
  message: string;
};

export async function getSupabaseHealth(): Promise<SupabaseHealth> {
  if (!hasSupabaseEnv()) {
    return {
      configured: false,
      reachable: false,
      message: 'Supabase environment variables are not configured yet.',
    };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .schema('public')
      .from('users')
      .select('id', { count: 'exact', head: true });

    return {
      configured: true,
      reachable: !error,
      message: error ? error.message : 'Supabase base connection is available.',
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error instanceof Error ? error.message : 'Unexpected Supabase connectivity error.',
    };
  }
}
