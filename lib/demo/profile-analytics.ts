import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function refreshDashboardProfileAnalytics() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('refresh_dashboard_user_profile_analytics');

  if (error) {
    throw error;
  }
}
