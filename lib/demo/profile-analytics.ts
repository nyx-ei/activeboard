import { createSupabaseAdminClient } from '@/lib/supabase/admin';

let refreshQueued = false;
let lastRefreshStartedAt = 0;
const MIN_REFRESH_INTERVAL_MS = 60_000;
const REFRESH_DELAY_MS = 1_500;

export async function refreshDashboardProfileAnalytics() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc(
    'refresh_dashboard_user_profile_analytics',
  );

  if (error) {
    throw error;
  }
}

export function scheduleDashboardProfileAnalyticsRefresh() {
  const now = Date.now();
  if (refreshQueued || now - lastRefreshStartedAt < MIN_REFRESH_INTERVAL_MS) {
    return;
  }

  refreshQueued = true;
  setTimeout(() => {
    refreshQueued = false;
    lastRefreshStartedAt = Date.now();
    void refreshDashboardProfileAnalytics().catch(() => undefined);
  }, REFRESH_DELAY_MS);
}
