create or replace function public.refresh_dashboard_user_profile_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  refresh_lock_key bigint := 20260625120000;
  lock_acquired boolean;
begin
  lock_acquired := pg_try_advisory_lock(refresh_lock_key);

  if not lock_acquired then
    return;
  end if;

  begin
    refresh materialized view public.dashboard_user_profile_analytics;
    refresh materialized view public.dashboard_user_session_confidence_breakdown;
  exception
    when others then
      perform pg_advisory_unlock(refresh_lock_key);
      raise;
  end;

  perform pg_advisory_unlock(refresh_lock_key);
end;
$$;
